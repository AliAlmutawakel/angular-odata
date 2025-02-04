import { Objects, Types } from '../utils';
import { Parser, StructuredTypeFieldConfig, StructuredTypeConfig, OptionsHelper, NONE_PARSER, EntityKey } from '../types';
import { ODataEnumTypeParser } from './enum-type';
import { COMPUTED } from '../constants';
import { ODataAnnotation } from '../schema/annotation';
import { raw } from '../resources/builder';

// JSON SCHEMA
type JsonSchemaSelect<T> = Array<keyof T>;
type JsonSchemaCustom<T> = {[P in keyof T]?: (schema: any, field: ODataStructuredTypeFieldParser<T[P]>) => any };
type JsonSchemaExpand<T> = {[P in keyof T]?: JsonSchemaOptions<T[P]> };
export type JsonSchemaOptions<T> = {
  select?: JsonSchemaSelect<T>;
  custom?: JsonSchemaCustom<T>;
  expand?: JsonSchemaExpand<T>;
}

export class ODataEntityTypeKey {
  name: string;
  ref: string;
  alias?: string;
  constructor({ref, alias}: {ref: string, alias?: string}) {
    this.ref = ref;
    this.alias = alias;
    this.name = alias || ref;
  }

  resolve(value: any) {
    return this.ref.split('/').reduce((acc, name) => acc[name], value);
  }
}

export class ODataStructuredTypeFieldParser<T> implements Parser<T> {
  name: string;
  type: string;
  private parser: Parser<T>;
  default?: any;
  maxLength?: number;
  collection: boolean;
  nullable: boolean;
  navigation: boolean;
  precision?: number;
  scale?: number;
  referential?: string;
  referenced?: string;
  annotations: ODataAnnotation[];

  constructor(name: string, field: StructuredTypeFieldConfig) {
    this.name = name;
    this.type = field.type;
    this.parser = NONE_PARSER;
    this.annotations = (field.annotations || []).map(annot => new ODataAnnotation(annot));
    this.default = field.default;
    this.maxLength = field.maxLength;
    this.collection = field.collection !== undefined ? field.collection : false;
    this.nullable = field.nullable !== undefined ? field.nullable : true;
    this.navigation = field.navigation !== undefined ? field.navigation : false;
    this.precision = field.precision;
    this.scale = field.scale;
    this.referential = field.referential;
    this.referenced = field.referenced;
  }
  findAnnotation(predicate: (annot: ODataAnnotation) => boolean) {
    return this.annotations.find(predicate);
  }

  validate(value: any, {
    create = false,
    patch = false,
    navigation = false
  }: {
    create?: boolean,
    patch?: boolean,
    navigation?: boolean
  } = {}): {[name: string]: any} | {[name: string]: any}[] | string[] | undefined {
    let errors;
    if (this.collection && Array.isArray(value)) {
      errors = value.map(v => this.validate(v, {create, patch, navigation})) as {[name: string]: any[]}[];
    } else if ((this.isStructuredType() && typeof value === 'object' && value !== null) ||
      (this.navigation && value !== undefined)) {
      errors = this.structured().validate(value, {create, patch, navigation}) || {} as {[name: string]: any[]};
    } else if (this.isEnumType() && (typeof value === 'string' || typeof value === 'number')) {
      errors = this.enum().validate(value, {create, patch, navigation});
    }
    else {
      // IsEdmType
      const computed = this.findAnnotation(a => a.type === COMPUTED);
      errors = [];
      if (
        !this.nullable &&
        (value === null || (value === undefined && !patch)) && // Is null or undefined without patch flag?
        !(computed?.bool && create) // Not (Is Computed field and create) ?
      ) {
        errors.push(`required`);
      }
      if (this.maxLength !== undefined && typeof value === 'string' && value.length > this.maxLength) {
        errors.push(`maxlength`);
      }
    }
    return !Types.isEmpty(errors) ? errors : undefined;
  }

  //#region Deserialize
  private parse(parser: ODataStructuredTypeParser<T>, value: any, options: OptionsHelper): any {
    const type = Types.isObject(value) ? options.helper.type(value) : undefined;
    if (type !== undefined) {
      return parser.findParser(c => c.isTypeOf(type)).deserialize(value, options);
    }
    return parser.deserialize(value, options);
  }

  deserialize(value: any, options: OptionsHelper): T {
    if (this.parser instanceof ODataStructuredTypeParser) {
      const parser = this.parser as ODataStructuredTypeParser<T>;
      return Array.isArray(value) ?
        value.map(v => this.parse(parser, v, options)) :
        this.parse(parser, value, options);
    }
    return this.parser.deserialize(value, Object.assign({field: this}, options));
  }
  //#endregion

  //#region Serialize
  private toJson(parser: ODataStructuredTypeParser<T>, value: any, options: OptionsHelper): any {
    const type = Types.isObject(value) ? options.helper.type(value) : undefined;
    if (type !== undefined) {
      return parser.findParser(c => c.isTypeOf(type)).serialize(value, options);
    }
    return parser.serialize(value, options);
  }

  serialize(value: T, options: OptionsHelper): any {
    if (this.parser instanceof ODataStructuredTypeParser) {
      const parser = this.parser as ODataStructuredTypeParser<T>;
      return Array.isArray(value) ?
        (value as any[]).map(v => this.toJson(parser, v, options)) :
        this.toJson(parser, value, options);
    }
    return this.parser.serialize(value, Object.assign({field: this}, options));
  }
  //#endregion

  //#region Encode
  encode(value: T, options: OptionsHelper): string {
    return this.parser.encode(value, Object.assign({field: this}, options));
  }
  //#endregion

  configure({findParserForType, options}: {
    findParserForType: (type: string) => Parser<any>,
    options: OptionsHelper
  }) {
    this.parser = findParserForType(this.type);
    if (this.default !== undefined)
      this.default = this.deserialize(this.default, options);
  }

  //#region Json Schema
  // https://json-schema.org/
  toJsonSchema(options: JsonSchemaOptions<T> = {}) {
    let schema: any = (this.parser instanceof ODataStructuredTypeFieldParser ||
      this.parser instanceof ODataStructuredTypeParser ||
      this.parser instanceof ODataEnumTypeParser) ?
    this.parser.toJsonSchema(options) : {title: this.name, type: "object"} as any;

    if (["Edm.String", "Edm.Date", "Edm.TimeOfDay", "Edm.DateTimeOffset", "Edm.Guid", "Edm.Binary"].indexOf(this.type) !== -1) {
      schema.type = "string";
      if (this.type === "Edm.Date")
        schema.format = "date";
      else if (this.type === "Edm.TimeOfDay")
        schema.format = "time";
      else if (this.type === "Edm.DateTimeOffset")
        schema.format = "date-time";
      else if (this.type === "Edm.Guid")
        schema.pattern = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";
      else if (this.type === "Edm.Binary")
        schema.contentEncoding = "base64";
      else if (this.type === "Edm.String" && this.maxLength)
        schema.maxLength = this.maxLength;
    } else if (["Edm.Int64", "Edm.Int32", "Edm.Int16", "Edm.Byte", "Edm.SByte"].indexOf(this.type) !== -1) {
      //TODO: Range
      schema.type = "integer";
    } else if (["Edm.Decimal", "Edm.Double"].indexOf(this.type) !== -1) {
      schema.type = "number";
    } else if (["Edm.Boolean"].indexOf(this.type) !== -1) {
      schema.type = "boolean";
    }
    if (this.default)
      schema.default = this.default;
    if (this.nullable)
      schema.type = [schema.type, 'null'];
    if (this.collection)
      schema = {
        type: "array",
        items: schema,
        additionalItems: false
      };
    return schema;
  }
  //#endregion

  isEdmType() {
    return this.type.startsWith("Edm.");
  }

  isEnumType() {
    return this.parser instanceof ODataEnumTypeParser;
  }

  enum() {
    if (!this.isEnumType())
      throw new Error("Field are not EnumType")
    return this.parser as ODataEnumTypeParser<T>;
  }

  isStructuredType() {
    return this.parser instanceof ODataStructuredTypeParser;
  }

  structured() {
    if (!this.isStructuredType())
      throw new Error("Field are not StrucuturedType")
    return this.parser as ODataStructuredTypeParser<T>;
  }
}

export class ODataStructuredTypeParser<T> implements Parser<T> {
  name: string;
  namespace: string;
  open: boolean;
  children: ODataStructuredTypeParser<any>[] = [];
  alias?: string;
  base?: string;
  parent?: ODataStructuredTypeParser<any>;
  keys?: ODataEntityTypeKey[];
  fields: ODataStructuredTypeFieldParser<any>[];

  constructor(config: StructuredTypeConfig<T>, namespace: string, alias?: string) {
    this.name = config.name;
    this.base = config.base;
    this.open = config.open || false;
    this.namespace = namespace;
    this.alias = alias;
    if (Array.isArray(config.keys))
      this.keys = config.keys.map(key => new ODataEntityTypeKey(key));
    this.fields = Object.entries<StructuredTypeFieldConfig>(config.fields as { [P in keyof T]: StructuredTypeFieldConfig })
      .map(([name, f]) => new ODataStructuredTypeFieldParser(name, f));
  }

  isTypeOf(type: string) {
    var names = [`${this.namespace}.${this.name}`];
    if (this.alias)
      names.push(`${this.alias}.${this.name}`);
    return names.indexOf(type) !== -1;
  }

  typeFor(name: string): string | undefined {
    const field = this.fields.find(f => f.name === name);
    if (field === undefined && this.parent !== undefined)
      return this.parent.typeFor(name);
    return field !== undefined ? field.type : undefined;
  }

  find(predicate: (p: ODataStructuredTypeParser<any>) => boolean): ODataStructuredTypeParser<any> | undefined {
    if (predicate(this))
      return this;
    let match: ODataStructuredTypeParser<any> | undefined;
    for (let ch of this.children) {
      match = ch.find(predicate);
      if (match !== undefined) break;
    }
    return match;
  }

  findParser(predicate: (p: ODataStructuredTypeParser<any>) => boolean): Parser<any> {
    return this.find(predicate) || NONE_PARSER;
  }

  // Deserialize
  deserialize(value: any, options: OptionsHelper): T {
    if (this.parent !== undefined)
      value = this.parent.deserialize(value, options);
    return Object.assign({}, value, this.fields
      .filter(f => f.name in value && value[f.name] !== undefined && value[f.name] !== null)
      .reduce((acc, f) => Object.assign(acc, { [f.name]: f.deserialize(value[f.name], options) }), {})
    );
  }

  // Serialize
  serialize(value: T, options: OptionsHelper): any {
    if (this.parent !== undefined)
      value = this.parent.serialize(value, options);
    return Object.assign({}, value, this.fields
      .filter(f => f.name in value && (value as any)[f.name] !== undefined && (value as any)[f.name] !== null)
      .reduce((acc, f) => Object.assign(acc, { [f.name]: f.serialize((value as any)[f.name], options) }), {})
    );
  }

  // Encode
  encode(value: T, options: OptionsHelper): any {
    return raw(JSON.stringify(this.serialize(value, options)));
  }

  configure({findParserForType, options}: {
    findParserForType: (type: string) => Parser<any>,
    options: OptionsHelper
  }) {
    if (this.base) {
      const parent = findParserForType(this.base) as ODataStructuredTypeParser<any>;
      parent.children.push(this);
      this.parent = parent;
    }
    this.fields.forEach(f => f.configure({findParserForType, options}));
  }

  resolveKey(attrs: T | {[name: string]: any}): EntityKey<T> | undefined {
    let key = this.parent?.resolveKey(attrs) || {};
    key = (this.keys || []).reduce((acc, k) => Object.assign(acc, { [k.name]: k.resolve(attrs) }), key) as any;
    return Objects.resolveKey(key) as EntityKey<T> | undefined;
  }

  defaults(): {[name: string]: any} {
    let value = this.parent?.defaults() || {};
    let fields = this.fields.filter(f => f.default !== undefined || f.isStructuredType());
    return Object.assign({}, value, fields.reduce((acc, f) => {
      let value = f.isStructuredType() ? f.structured().defaults() : f.default;
      if (!Types.isEmpty(value))
        Object.assign(acc, {[f.name]: value });
      return acc;
    }, {}));
  }

  // Json Schema
  toJsonSchema(options: JsonSchemaOptions<T> = {}) {
    let schema: any = this.parent?.toJsonSchema(options) ||
      {
        $schema: "http://json-schema.org/draft-07/schema#",
        $id: `${this.namespace}.${this.name}`,
        title: this.name,
        type: "object",
        properties: {},
        required: []
      };
    const fields = this.fields
      .filter(f => (!f.navigation || (options.expand && f.name in options.expand)) && (!options.select || (<string[]>options.select).indexOf(f.name) !== -1));
    schema.properties = Object.assign({}, schema.properties, fields
      .map(f => {
        let expand = options.expand && f.name in options.expand ? (options.expand as any)[f.name] : undefined;
        let schema = f.toJsonSchema(expand);
        if (options.custom && f.name in options.custom)
          schema = (options.custom[f.name as keyof T] as (schema: any, field: ODataStructuredTypeFieldParser<any>) => any)(schema, f);
        return { [f.name]: schema };
      })
      .reduce((acc, v) => Object.assign(acc, v), {}));
    schema.required = [...schema.required, ...fields.filter(f => !f.nullable).map(f => f.name)];
    return schema;
  }

  validate(attrs: any, {
    create = false,
    patch = false,
    navigation = false,
  }: {
    create?: boolean,
    patch?: boolean,
    navigation?: boolean
  } = {}
  ): {[name: string]: any} | undefined {
    const errors = (this.parent?.validate(attrs, {create, patch, navigation}) || {}) as {[name: string]: any };
    const fields = this.fields.filter(f => !f.navigation || navigation);
    for (var field of fields) {
      const value = attrs[field.name as keyof T];
      const errs = field.validate(value, {create, patch, navigation});
      if (errs !== undefined) {
        errors[field.name] = errs;
      }
    }
    return !Types.isEmpty(errors) ? errors : undefined;
  }
}
