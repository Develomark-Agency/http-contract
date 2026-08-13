import type { StandardJSONSchemaV1 } from "@standard-schema/spec";
import type { Endpoint } from "./endpoint";
import type { AnyEndpointModifier } from "./endpoint-modifier";

/**
 * Base class for exposing endpoint inputs to another system.
 *
 * Subclasses choose a JSON Schema target, convert the endpoint schema to the
 * target system's format, and decode values from that system into endpoint call
 * parameters. Both the source schema and converted schema are built once.
 *
 * @typeParam E - The endpoint being adapted.
 * @typeParam Schema - The schema format exposed to the other system.
 */
export abstract class Adapter<
  E extends Endpoint<AnyEndpointModifier[]>,
  Schema
> {
  #sourceSchema?: Record<string, unknown>;
  #schema?: { value: Schema };

  /** Creates an adapter for an endpoint. */
  constructor(readonly endpoint: E) {}

  protected abstract readonly target: StandardJSONSchemaV1.Target;

  protected get sourceSchema() {
    return this.#sourceSchema ??= this.endpoint.toJSONSchema({ target: this.target });
  }

  /**
   * The converted schema, built and cached on first access.
   *
   * Errors caused by an unsupported source schema surface when this property is
   * first read, not when the adapter is constructed.
   */
  get schema(): Schema {
    return (this.#schema ??= { value: this.createSchema(this.sourceSchema) }).value;
  }

  protected abstract createSchema(source: Record<string, unknown>): Schema;

  /**
   * Converts external input into parameters accepted by the endpoint.
   * Implementations may normalize provider-specific placeholder values.
   */
  abstract decode(value: unknown): Endpoint.InferCallParams<E>;
}
