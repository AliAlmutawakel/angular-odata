import { EnumHelper } from '../helpers';
import { raw } from '../resources/builder';
import { ODataAnnotation } from '../schema/annotation';
import { EnumTypeConfig, Parser, OptionsHelper, EnumTypeFieldConfig } from '../types';

export class ODataEnumTypeFieldParser {
  name: string;
  value: number;
  annotations: ODataAnnotation[];
  constructor(name: string, field: EnumTypeFieldConfig) {
    this.name = name;
    this.value = field.value;
    this.annotations = (field.annotations || []).map(annot => new ODataAnnotation(annot));
  }
  findAnnotation(predicate: (annot: ODataAnnotation) => boolean) {
    return this.annotations.find(predicate);
  }
}
export class ODataEnumTypeParser<T> implements Parser<T> {
  name: string;
  namespace: string;
  alias?: string;
  flags?: boolean;
  members: { [name: string]: number } | { [value: number]: string };
  fields: ODataEnumTypeFieldParser[];
  constructor(config: EnumTypeConfig<T>, namespace: string, alias?: string) {
    this.name = config.name;
    this.namespace = namespace;
    this.alias = alias;
    this.flags = config.flags;
    this.members = config.members;
    this.fields = Object.entries(config.fields)
      .map(([name, f]) => new ODataEnumTypeFieldParser(name, f));
  }

  isTypeOf(type: string) {
    var names = [`${this.namespace}.${this.name}`];
    if (this.alias)
      names.push(`${this.alias}.${this.name}`);
    return names.indexOf(type) !== -1;
  }

  // Deserialize
  deserialize(value: string, options: OptionsHelper): T {
    // string -> Type
    if (this.flags) {
      return EnumHelper.toValues(this.members, value).reduce((acc, v) => acc | v, 0) as any;
    } else {
      return EnumHelper.toValue(this.members, value) as any;
    }
  }

  // Serialize
  serialize(value: T, options: OptionsHelper): string {
    // Type -> string
    if (this.flags) {
      let names = EnumHelper.toNames(this.members, value);
      if (!options.stringAsEnum)
        names = names.map(name => `${this.namespace}.${this.name}'${name}'`)
      return names.join(", ");
    } else {
      let name = EnumHelper.toName(this.members, (<any>value) as number);
      if (!options.stringAsEnum)
        name = `${this.namespace}.${this.name}'${name}'`;
      return name;
    }
  }

  //Encode
  encode(value: T, options: OptionsHelper): any {
    const serialized = this.serialize(value, options);
    return options.stringAsEnum ? raw(`'${serialized}'`) : raw(serialized);
  }

  // Json Schema
  toJsonSchema() {
    let property = <any>{
      title: this.name,
      type: "string"
    };
    property.enum = this.fields.map(f => f.name);
    return property;
  }
  validate(member: string | number, {
    create = false,
    patch = false,
    navigation = false,
  }: {
    create?: boolean,
    patch?: boolean,
    navigation?: boolean
  } = {}): string[] | undefined {
    if (this.flags) {
      let members = EnumHelper.toValues(this.members, member);
      return members.some(member => !(member in this.members)) ? ['mismatch'] : undefined;
    } else {
      return (!(member in this.members)) ? ['mismatch'] : undefined;
    }
  }
}
