import { Router } from 'express';
import { privateRoute } from '../middlewares/auth.middleware.js';
import controlTopUp from '../controllers/topup.controller.js';
const routerTopup = Router();

routerTopup.get(
  '/countries',
privateRoute,
  controlTopUp.GetCountries
);
routerTopup.get(
  '/providers',
  privateRoute,
  controlTopUp.GetProviders
);
routerTopup.get(
  '/products',
  privateRoute,
  controlTopUp.GetProducts
);
routerTopup.post(
  '/create-topup',
  privateRoute,
  controlTopUp.SendTopup
);
routerTopup.get(
  '/get-topups',
  privateRoute,
  controlTopUp.GetTopups
);
export default routerTopup;
