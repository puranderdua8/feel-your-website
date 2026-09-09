import { defineActions } from "@feel-your-website/action-core";
import {
  ACTION_CONTRACT_FIXTURE,
  runActionInvokerContract,
} from "@feel-your-website/action-core/contract-tests";
import { describe, it } from "vitest";

import { HttpActionInvoker } from "./HttpActionInvoker.js";
import type { HttpActionBindings } from "./bindings.js";

/**
 * Runs the shared `ActionInvoker` contract against a real HTTP endpoint.
 *
 * Gated on `ACTION_HTTP_BASE_URL`: point it at a stub server whose
 * `GET /known` returns `200 application/json` and whose `GET /unavailable`
 * returns `503`, then this suite runs. Absent — the usual case, including CI
 * — it is skipped; `HttpActionInvoker.test.ts` covers the same contract with
 * a stubbed `fetch`.
 */
const baseUrl = process.env.ACTION_HTTP_BASE_URL;

if (baseUrl) {
  const host = new URL(baseUrl).host;

  const catalog = defineActions([
    {
      id: ACTION_CONTRACT_FIXTURE.knownId,
      kind: "query",
      method: "GET",
      description: "Contract fixture.",
      input: [],
      allowedSources: ["static"],
    },
  ]);

  const bindings = (path: string): HttpActionBindings => ({
    [ACTION_CONTRACT_FIXTURE.knownId]: {
      urlTemplate: `${baseUrl}${path}`,
      method: "GET",
      allowedParams: [],
      allowedHost: host,
    },
  });

  runActionInvokerContract({
    name: "HttpActionInvoker (live)",
    createInvoker: () =>
      new HttpActionInvoker({ catalog, bindings: bindings("/known"), hostAllowlist: [host] }),
    createUnavailableInvoker: () =>
      new HttpActionInvoker({ catalog, bindings: bindings("/unavailable"), hostAllowlist: [host] }),
  });
} else {
  describe.skip("HttpActionInvoker (live)", () => {
    it("needs ACTION_HTTP_BASE_URL pointed at a stub server; HttpActionInvoker.test.ts covers the contract with a stubbed fetch", () => {
      /* skipped */
    });
  });
}
