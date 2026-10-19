// Kuryerga biriktirish savati — qurilmada saqlanadi (ega qarori D2, skaner 2-bosqich): `/dispatch`,
// `/scan/:token` «Kuryerga biriktirish» va 3-bosqichda universal skaner rejimi.
export {
  addToDispatchBasket,
  DISPATCH_BASKET_LIMIT,
  DISPATCH_BASKET_TTL_MS,
  dispatchBasketStorageKey,
  isInDispatchBasket,
  pruneDispatchBasket,
  readDispatchBasket,
  removeFromDispatchBasket,
  resetDispatchBaskets,
  setDispatchBasketSelected,
  useDispatchBasket,
  useDispatchBasketScope,
} from "./model/dispatchBasket";
export type { AddToDispatchBasketResult, DispatchBasketItem, DispatchBasketScope } from "./model/dispatchBasket";
export { normalizeDispatchOrder, readDeliveryKind, sanitizeDispatchOrder } from "./model/dispatchOrder";
export type { DispatchDeliveryKind, DispatchOrder } from "./model/dispatchOrder";
