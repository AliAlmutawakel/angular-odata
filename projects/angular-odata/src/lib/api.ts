import { HttpEvent, HttpEventType } from '@angular/common/http';
import { NEVER, Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { ApiConfig, ApiOptions, NONE_PARSER, Parser } from './types';
import { EDM_PARSERS } from './parsers/index';
import { ODataSchema, ODataEnumType, ODataCallable, ODataEntitySet, ODataStructuredType } from './schema/index';
import { ODataModel, ODataCollection } from './models/index';
import { ODataRequest, ODataResponse } from './resources/index';
import { ODataCache, ODataInMemoryCache } from './cache/index';
import { ODataApiOptions } from './options';
import { DEFAULT_VERSION } from './constants';
import { ODataEntityService } from './services/entity';

export class ODataApi {
  requester?: (request: ODataRequest<any>) => Observable<any>;
  serviceRootUrl: string;
  metadataUrl: string;
  name?: string;
  version: string;
  default: boolean;
  creation: Date;
  // Options
  options: ODataApiOptions;
  // Cache
  cache!: ODataCache<any>;
  // Error Handler
  errorHandler?: (error: any, caught: Observable<any>) => Observable<never>;
  // Base Parsers
  parsers: { [type: string]: Parser<any> };
  // Schemas
  schemas: ODataSchema[];

  constructor(config: ApiConfig) {
    this.serviceRootUrl = config.serviceRootUrl;
    if (this.serviceRootUrl.indexOf('?') != -1)
      throw new Error("The 'serviceRootUrl' should not contain query string. Please use 'params' to add extra parameters");
    if (!this.serviceRootUrl.endsWith('/'))
      this.serviceRootUrl += '/';
    this.metadataUrl = `${this.serviceRootUrl}$metadata`;
    this.name = config.name;
    this.version = config.version || DEFAULT_VERSION;
    this.default = config.default || false;
    this.creation = config.creation || new Date();
    this.options = new ODataApiOptions(Object.assign(<ApiOptions>{version: this.version}, config.options || {}));

    this.cache = (config.cache as ODataCache<any>) || new ODataInMemoryCache();
    this.errorHandler = config.errorHandler;

    this.parsers = config.parsers || EDM_PARSERS;

    this.schemas = (config.schemas || []).map(schema => new ODataSchema(schema, this));
  }

  configure(settings: { requester?: (request: ODataRequest<any>) => Observable<any> } = {}) {
    this.requester = settings.requester;
    this.schemas.forEach(schema => {
      schema.configure({
        findParserForType: (type: string) => this.findParserForType(type),
        findOptionsForType: (type: string) => this.findOptionsForType(type)
      });
    });
  }

  request(req: ODataRequest<any>): Observable<any> {
    let res$ = this.requester !== undefined ? this.requester(req) : NEVER;
    res$ = res$.pipe(
      map((res: HttpEvent<any>) => res.type === HttpEventType.Response ? ODataResponse.fromHttpResponse<any>(req, res) : res
    ));

    if (this.errorHandler !== undefined)
      res$ = res$.pipe(catchError(this.errorHandler));

    return (this.cache.isCacheable(req)) ?
      this.cache.handleRequest(req, res$) :
      res$;
  }

  //#region Find Schema for Type
  private findSchemaForType(type: string) {
    const schemas = this.schemas.filter(s => s.isNamespaceOf(type));
    if (schemas.length > 1)
      return schemas.sort((s1, s2) => s1.namespace.length - s2.namespace.length).pop();
    if (schemas.length === 1) return schemas[0];
    return undefined;
  }

  public findEnumTypeForType<T>(type: string) {
    return this.findSchemaForType(type)?.findEnumTypeForType<T>(type);
  }

  public findStructuredTypeForType<T>(type: string) {
    return this.findSchemaForType(type)?.findStructuredTypeForType<T>(type);
  }

  public findCallableForType<T>(type: string) {
    return this.findSchemaForType(type)?.findCallableForType<T>(type);
  }

  public findEntitySetForType(type: string) {
    return this.findSchemaForType(type)?.findEntitySetForType(type);
  }
  //#region Model and Collection for type
  public findModelForType(type: string) {
    return this.findStructuredTypeForType<any>(type)?.model as typeof ODataModel | undefined;
  }

  public findCollectionForType(type: string) {
    return this.findStructuredTypeForType<any>(type)?.collection as typeof ODataCollection | undefined;
  }

  public findServiceForType(type: string) {
    return this.findEntitySetForType(type)?.service as typeof ODataEntityService | undefined;
  }
  //#endregion

  //#region find Schema for Entity Type
  public findEntitySetForEntityType(entityType: string) {
    return this.schemas.reduce((acc, schema) => [...acc, ...schema.entitySets], <ODataEntitySet[]>[])
      .find(e => e.entityType === entityType);
  }

  public findServiceForEntityType(entityType: string) {
    return this.findEntitySetForEntityType(entityType)?.service as typeof ODataEntityService | undefined;
  }
  //#endregion

  //#endregion

  //#region Find Config for Name
  public findEnumTypeByName<T>(name: string) {
    return this.schemas.reduce((acc, schema) => [...acc, ...schema.enums], <ODataEnumType<T>[]>[])
      .find(e => e.name === name);
  }

  public findStructuredTypeByName<T>(name: string) {
    return this.schemas.reduce((acc, schema) => [...acc, ...schema.entities], <ODataStructuredType<T>[]>[])
      .find(e => e.name === name);
  }

  public findCallableByName<T>(name: string) {
    return this.schemas.reduce((acc, schema) => [...acc, ...schema.callables], <ODataCallable<T>[]>[])
      .find(e => e.name === name);
  }

  public findEntitySetByName(name: string) {
    return this.schemas.reduce((acc, schema) => [...acc, ...schema.entitySets], <ODataEntitySet[]>[])
      .find(e => e.name === name);
  }

  //#region Model and Collection for type
  public findModelByName(name: string) {
    return this.findStructuredTypeByName<any>(name)?.model as typeof ODataModel | undefined;
  }
  public findCollectionByName(name: string) {
    return this.findStructuredTypeByName<any>(name)?.collection as typeof ODataCollection | undefined;
  }
  public findServiceByName(name: string) {
    return this.findEntitySetByName(name)?.service as typeof ODataEntityService | undefined;
  }
  //#endregion
  //#endregion

  public findParserForType<T>(type: string) {
    // Base Parsers
    if (type in this.parsers) {
      return this.parsers[type] as Parser<T>;
    }

    // Enum, Strucutred and Callable Parsers
    if (!type.startsWith("Edm.")) {
      let value = this.findEnumTypeForType<T>(type) || this.findStructuredTypeForType<T>(type) || this.findCallableForType<T>(type);
      return value?.parser as Parser<T>;
    }

    // None Parser
    return NONE_PARSER;
  }

  public findOptionsForType<T>(type: string) {
    // Strucutred Options
    let st = this.findStructuredTypeForType(type);
    return (st !== undefined && st.model !== undefined && st.model?.meta !== null) ? st.model.meta : undefined;
  }
}
