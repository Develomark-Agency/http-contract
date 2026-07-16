import type { EndpointState } from "./types/index";

const endpointStates = new WeakMap<Function, EndpointState>();

export function registerEndpointState(endpoint: Function, state: EndpointState) {
  endpointStates.set(endpoint, state);
}

export function getEndpointState(endpoint: Function) {
  const state = endpointStates.get(endpoint);
  if (!state) throw new TypeError("Expected an http-contract endpoint");
  return state;
}
