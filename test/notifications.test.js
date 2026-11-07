import assert from "node:assert/strict";
import { after, before, test, mock } from "node:test";
import express from "express";
import router from "../src/routes/notifys.routes.js";
import supabase from "../src/models/supabase/conexion.js";
import model from "../src/models/supabase/notifySupbase.js";
import profiles from "../src/models/supabase/profil.supabase.js";

const app = express();
app.use("/api/notifys", router);
let server;
let baseUrl;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/notifys`;
});
after(() => new Promise((resolve) => server.close(resolve)));

test("legacy endpoint remains blocked", async () => {
  const response = await fetch(`${baseUrl}/get-notification`);
  assert.equal(response.status, 503);
});

test("list requires authentication and scopes results to the authenticated user", async () => {
  const getUser = mock.method(supabase.auth, "getUser", async (token) => ({
    data: { user: token === "user-a-token" ? { id: "user-a" } : token === "user-b-token" ? { id: "user-b" } : null },
    error: null,
  }));
  const profile = mock.method(profiles, "getProfileById", async (id) => [{ id }]);
  const rows = [
    { id: "a", user_id: "user-a", title: "A" },
    { id: "b", user_id: "user-b", title: "B" },
  ];
  const from = mock.method(supabase, "from", (table) => {
    assert.equal(table, "notifications");
    let userId;
    return {
      select(columns) {
        assert.equal(columns, "id,title,message,type,read_at,created_at");
        return this;
      },
      eq(column, value) {
        assert.equal(column, "user_id");
        userId = value;
        return this;
      },
      order() { return this; },
      async limit(limit) {
        assert.equal(limit, 50);
        return { data: rows.filter((row) => row.user_id === userId).map(({ id, title }) => ({ id, title })), error: null };
      },
    };
  });
  try {
    assert.equal((await fetch(`${baseUrl}/me`)).status, 401);
    assert.equal((await fetch(`${baseUrl}/me`, { headers: { authorization: "Bearer invalid" } })).status, 401);
    for (const [token, expected] of [["user-a-token", "a"], ["user-b-token", "b"]]) {
      const response = await fetch(`${baseUrl}/me?user_id=other-user`, { headers: { authorization: `Bearer ${token}` } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual((await response.json()).data.map((row) => row.id), [expected]);
    }
    await assert.rejects(() => model.fetchNotificationsFromDatabase(), /Authenticated user/);
  } finally {
    getUser.mock.restore();
    profile.mock.restore();
    from.mock.restore();
  }
});
