import { Observable } from 'rxjs';

import { ODataValueResource } from './value';

import { ODataResource } from '../resource';
import { ODataQueryOptions, QueryOptionNames } from '../query-options';
import { ODataPathSegments, PathSegmentNames } from '../path-segments';
import { HttpPropertyOptions, HttpEntitiesOptions, HttpEntityOptions, HttpOptions } from './options';
import { ODataProperty, ODataEntities, ODataEntity, ODataEntityMeta, ODataEntitiesMeta } from '../responses';
import { map } from 'rxjs/operators';
import { ODataStructuredTypeParser } from '../../parsers/structured-type';
import { ODataModel, ODataCollection } from '../../models';
import { ODataApi } from '../../api';
import { Expand, Filter, OrderBy, PlainObject, Select, Transform } from '../builder';

export class ODataPropertyResource<T> extends ODataResource<T> {
  //#region Factory
  static factory<P>(api: ODataApi, path: string, type: string | undefined, segments: ODataPathSegments, options: ODataQueryOptions) {
    const segment = segments.add(PathSegmentNames.property, path)
    if (type)
      segment.type(type)
    options.clear();
    return new ODataPropertyResource<P>(api, segments, options);
  }

  clone() {
    return new ODataPropertyResource<T>(this.api, this.pathSegments.clone(), this.queryOptions.clone());
  }
  //#endregion

  //#region Function Config
  get schema() {
    let type = this.type();
    return (type !== undefined) ?
      this.api.findStructuredTypeForType<T>(type) : undefined;
  }
  ////#endregion

  asModel<M extends ODataModel<T>>(entity: Partial<T>, meta?: ODataEntityMeta): M {
    let Model = ODataModel;
    let type = this.type();
    if (type !== undefined) {
      Model = this.api.findModelForType(type) || ODataModel;
    }
    return new Model(entity, {resource: this, meta}) as M;
  }

  asCollection<C extends ODataCollection<T, ODataModel<T>>>(entities: Partial<T>[], meta?: ODataEntitiesMeta): C {
    let Collection = ODataCollection;
    let type = this.type();
    if (type !== undefined) {
      Collection = this.api.findCollectionForType(type) || ODataCollection;
    }
    return new Collection(entities, {resource: this, meta}) as C;
  }

  //#region Inmutable Resource
  value() {
    return ODataValueResource.factory<T>(this.api, this.type(), this.pathSegments.clone(), this.queryOptions.clone());
  }

  property<P>(path: string) {
    let type = this.type();
    if (type !== undefined) {
      let parser = this.api.findParserForType<P>(type);
      type = parser instanceof ODataStructuredTypeParser?
        parser.typeFor(path) : undefined;
    }
    return ODataPropertyResource.factory<P>(this.api, path, type, this.pathSegments.clone(), this.queryOptions.clone());
  }
  //#endregion

  //#region Mutable Resource
  get segment() {
    const segments = this.pathSegments;
    return {
      entitySet() {
        return segments.get(PathSegmentNames.entitySet);
      },
      singleton() {
        return segments.get(PathSegmentNames.singleton);
      },
      property() {
        return segments.get(PathSegmentNames.property);
      }
    }
  }

  get query() {
    const options = this.queryOptions;
    return {
      select(opts?: Select<T>) {
        return options.option<Select<T>>(QueryOptionNames.select, opts);
      },
      expand(opts?: Expand<T>) {
        return options.option<Expand<T>>(QueryOptionNames.expand, opts);
      },
      transform(opts?: Transform<T>) {
        return options.option<Transform<T>>(QueryOptionNames.transform, opts);
      },
      search(opts?: string) {
        return options.option<string>(QueryOptionNames.search, opts);
      },
      filter(opts?: Filter) {
        return options.option<Filter>(QueryOptionNames.filter, opts);
      },
      orderBy(opts?: OrderBy<T>) {
        return options.option<OrderBy<T>>(QueryOptionNames.orderBy, opts);
      },
      format(opts?: string) {
        return options.option<string>(QueryOptionNames.format, opts);
      },
      top(opts?: number) {
        return options.option<number>(QueryOptionNames.top, opts);
      },
      skip(opts?: number) {
        return options.option<number>(QueryOptionNames.skip, opts);
      },
      skiptoken(opts?: string) {
        return options.option<string>(QueryOptionNames.skiptoken, opts);
      },
      custom(opts?: PlainObject) {
        return options.option<PlainObject>(QueryOptionNames.custom, opts);
      }
    }
  }
  //#endregion

  //#region Requests
  get(options: HttpEntityOptions): Observable<ODataEntity<T>>;
  get(options: HttpEntitiesOptions): Observable<ODataEntities<T>>;
  get(options: HttpPropertyOptions): Observable<ODataProperty<T>>;
  get(options: HttpEntityOptions & HttpEntitiesOptions & HttpPropertyOptions): Observable<any> {
    return super.get(options);
  }
  //#endregion

  //#region Custom
  fetch(options?: HttpOptions): Observable<T | null> {
    return this.get(
      Object.assign<HttpOptions, HttpPropertyOptions>(<HttpPropertyOptions>{ responseType: 'property' }, options || {})
    ).pipe(map(({property}) => property));
  }

  model(options?: HttpOptions): Observable<ODataModel<T> | null> {
    return this.get(
      Object.assign<HttpOptions, HttpEntityOptions>(<HttpEntityOptions>{ responseType: 'entity' }, options || {})
    ).pipe(map(({entity, meta}) => entity ? this.asModel(entity, meta) : null));
  }

  collection(options?: HttpOptions): Observable<ODataCollection<T, ODataModel<T>> | null> {
    return this.get(
      Object.assign<HttpOptions, HttpEntitiesOptions>(<HttpEntitiesOptions>{ responseType: 'entities' }, options || {})
    ).pipe(map(({entities, meta}) => entities ? this.asCollection(entities, meta) : null));
  }
  //#endregion
}
