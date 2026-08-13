import type { StandardJSONSchemaV1 } from "@standard-schema/spec";
import type { Endpoint } from "./endpoint";
import type { AnyEndpointModifier } from "./endpoint-modifier";

export abstract class Adapter<
  E extends Endpoint<AnyEndpointModifier[]>,
  Schema
> {
  #sourceSchema?: Record<string, unknown>;
  #schema?: { value: Schema };

  constructor(readonly endpoint: E) {}

  protected abstract readonly target: StandardJSONSchemaV1.Target;

  protected get sourceSchema() {
    return this.#sourceSchema ??= this.endpoint.toJSONSchema({ target: this.target });
  }

  get schema(): Schema {
    return (this.#schema ??= { value: this.createSchema(this.sourceSchema) }).value;
  }

  protected abstract createSchema(source: Record<string, unknown>): Schema;

  abstract decode(value: unknown): Endpoint.InferCallParams<E>;
}
