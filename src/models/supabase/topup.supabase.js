import requestDing from "../../apis/ding.js";
import supabase from "./conexion.js";

const modelTopup = {
  createTopup: async (dataTopup, profile_type) => {
   
    // Always a dry run: the real transfer is only sent after the wallet debit.
    const validate_received_value = await requestDing("SendTransfer", "POST", {
      SkuCode: dataTopup.sku_code,
      SendValue: dataTopup.send_value_net,
      SendCurrencyIso: dataTopup.send_currency?.toUpperCase(),
      AccountNumber: dataTopup.account_number,
      DistributorRef: dataTopup.account_number,
      ValidateOnly: true,
    });

    if (dataTopup.validate_only) {
      return {
        success: Boolean(validate_received_value?.success),
        error: validate_received_value?.success
          ? undefined
          : "Validation with Ding failed.",
        received_value:
          validate_received_value?.data?.TransferRecord?.Price?.ReceiveValue,
      };
    }

    if (!validate_received_value?.success) {
      return {
        success: false,
        error: "Validation with Ding failed.",
      };
    }

    const received_value =
      validate_received_value?.data?.TransferRecord?.Price?.ReceiveValue;

    if (!received_value) {
      return {
        success: false,
        error: "Failed to retrieve received value from Ding validation.",
      };
    }

    // 1. Criar registro e debitar a carteira.
    const { data, error } = await supabase.rpc("create_topup", {
      p_profile_id: dataTopup.actor_id,
      p_type: profile_type,
      p_sku_code: dataTopup.sku_code,
      p_send_value: dataTopup.send_value,
      p_account_number: dataTopup.account_number,
      p_operator_name: dataTopup.operator_name,
      p_send_currency: dataTopup.send_currency,
      p_transfer_id: dataTopup.transfer_id ?? null,
      p_received_currency: dataTopup.received_currency,
      p_received_value: received_value,
      p_fee: dataTopup.fee ?? 0,
      p_fee_provider: dataTopup.fee_provider ?? 0,
      p_error_code: null,
      p_error_message: null,
      p_raw_api_response: null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const topup = Array.isArray(data) ? data[0] : data;

    if (!topup?.id) {
      return {
        success: false,
        error: "The database did not return the top-up ID.",
      };
    }

    // 2. Enviar ao DingConnect.
    const responseDing = await requestDing("SendTransfer", "POST", {
      SkuCode: dataTopup.sku_code,
      SendValue: dataTopup.send_value_net,
      SendCurrencyIso: dataTopup.send_currency?.toUpperCase(),
      AccountNumber: dataTopup.account_number,
      DistributorRef: String(topup.id),
      ValidateOnly: false,
    });

    const dingRecord = responseDing?.data?.TransferRecord;
    const dingState = dingRecord?.ProcessingState;

    // A network error or 5xx leaves the outcome unknown, so no refund is issued:
    // the transfer may have been delivered and must be reconciled manually.
    const outcomeUnknown =
      !responseDing?.success &&
      (responseDing?.status == null || responseDing.status >= 500);

    if (outcomeUnknown) {
      console.error(
        "[createTopup] Unknown Ding outcome for",
        topup.id,
        responseDing,
      );
      return {
        success: false,
        error: `Top-up ${topup.id} is pending manual review.`,
      };
    }

    const dingFailed =
      !responseDing?.success ||
      responseDing.data?.ResultCode !== 1 ||
      !["Complete", "Processing", "Submitted"].includes(dingState);

    if (dingFailed) {
      const { error: processingRefundError } = await supabase.rpc(
        "refund_topup",
        {
          p_topup_id: topup.id,
          p_error_code: "DING_FAILED",
          p_error_message: `Ding transfer failed with status: ${dingState ?? responseDing?.error}`,
          p_raw_api_response: JSON.stringify(responseDing),
        },
      );

      if (processingRefundError) {
        return {
          success: false,
          error: `Failed to process refund for top-up ID: ${topup.id}`,
        };
      }
      return {
        success: false,
        error: `Ding transfer failed with status: ${dingState ?? responseDing?.error}`,
      };
    }

    const finalStatus = dingState === "Complete" ? "complete" : "processing";

    const { data: updatedTopup, error: updateError } = await supabase
      .from("topups")
      .update({
        status: finalStatus,
        transfer_id: dingRecord?.TransferId?.TransferRef,
      })
      .eq("id", topup.id)
      .select();

    if (updateError) {
      // Ding already accepted the transfer, so reporting failure would invite a retry and a double charge.
      console.error(
        "[createTopup] Ding accepted but DB update failed",
        topup.id,
        updateError,
      );
      return {
        success: true,
        data: {
          ...topup,
          status: finalStatus,
          transfer_id: dingRecord?.TransferId?.TransferRef,
        },
        received_value: dingRecord?.Price?.ReceiveValue ?? received_value,
      };
    }

    return {
      success: true,
      data: updatedTopup[0],
      received_value: dingRecord?.Price?.ReceiveValue ?? received_value,
    };
  },

  // Re-check "processing" top-ups (and stale "pending" ones left by an unknown
  // Ding outcome) against DingConnect and settle them.
  reconcileTopups: async ({ limit = 50 } = {}) => {
    const { data: processing, error } = await supabase
      .from("topups")
      .select("id, status")
      .eq("status", "processing")
      .limit(limit);

    if (error) return { success: false, error: error.message };

    const { data: pending, error: pendingError } = await supabase
      .from("topups")
      .select("id, status")
      .eq("status", "pending")
      .limit(limit);

    if (pendingError) {
      console.error("[reconcileTopups] pending query failed:", pendingError);
    }

    const results = [];

    for (const topup of [...(processing || []), ...(pending || [])]) {
      const ding = await requestDing("ListTransferRecords", "POST", {
        DistributorRef: String(topup.id),
        Take: 1,
      });

      const record = ding?.data?.Items?.[0];
      const state = record?.TransferRecord?.ProcessingState;


      if (!ding?.success || !record || !state) {
        // Nothing to act on: a missing record may only mean Ding has not indexed it yet.
        results.push({ id: topup.id, action: "unresolved" });
        continue;
      }

      if (state === "Complete") {
        const { error: updateError } = await supabase
          .from("topups")
          .update({
            status: "completed",
            transfer_id: record?.TransferRecord?.TransferId?.TransferRef,
          })
          .eq("id", topup.id);


        if (updateError) {
          console.error(`Failed to update top-up ${topup.id}:`, updateError);
          results.push({
            id: topup.id,
            action: updateError ? "update_failed" : "complete",
          });
        }
      } else if (state === "Failed" || state === "Cancelled") {
        const { error: refundError } = await supabase.rpc("refund_topup", {
          p_topup_id: topup.id,
          p_error_code: `DING_${state.toUpperCase()}`,
          p_error_message: `Ding transfer ended with status: ${state}`,
          p_raw_api_response: JSON.stringify(ding.data),
        });

        results.push({
          id: topup.id,
          action: refundError ? "refund_failed" : "refunded",
        });
      } else {
        results.push({ id: topup.id, action: "still_processing" });
      }
    }

    return { success: true, data: results };
  },

  getTopupById: async (id) => {
    const { data, error } = await supabase.rpc("get_topup_by_statement_id", {
      p_statement_id: id,
    });

    if (error) return { success: false, error };

    return { success: true, data };
  },

  getTopupHistory: async (profile_id) => {
    const { data, error } = await supabase.rpc("get_topup_history", {
      p_profile_id: profile_id || null,
    });

    if (error) return { success: false, error };
    return { success: true, data: data || [] };
  },
};

export default modelTopup;
