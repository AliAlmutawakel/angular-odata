import { EMPTY, Observable } from 'rxjs';

import { ODataValueResource } from './value';

import { ODataResource } from '../resource';
import { ODataQueryOptions, QueryOptionNames } from '../query-options';
import { ODataPathSegments, PathSegmentNames } from '../path-segments';
import { HttpPropertyOptions, HttpEntitiesOptions, HttpEntityOptions, HttpOptions } from './options';
import { ODataProperty, ODataEntities, ODataEntity, ODataEntityAnnotations, ODataEntitiesAnnotations } from '../responses';
import { concatMap, expand, map, toArray } from 'rxjs/operators';
import { ODataStructuredTypeParser } from '../../parsers/structured-type';
import { ODataModel, ODataCollection } from '../../models';
import { ODataApi } from '../../api';
import { Expand, Filter, isQueryCustomType, OrderBy, Select, Transform } from '../builder';
import { ODataNavigationPropertyResource } from './navigation-property';
import { EntityKey } from '../../types';
import { Objects, Types } from '../../utils';

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
    return new ODataPropertyResource<T>(this.api, this.cloneSegments(), this.cloneQuery());
  }
  //#endregion

  //#region Function Config
  get schema() {
    let type = this.type();
    return (type !== undefined) ?
      this.api.findStructuredTypeForType<T>(type) : undefined;
  }
  ////#endregion

  asModel<M extends ODataModel<T>>(entity: Partial<T> | {[name: string]: any}, {annots, reset}: {annots?: ODataEntityAnnotations, reset?: boolean} = {}): M {
    let schema = this.schema;
    if (annots?.type !== undefined) {
      schema = this.api.findStructuredTypeForType(annots.type);
    }
    const Model = schema?.model || ODataModel;
    return new Model(entity, {resource: this, annots, reset}) as M;
  }

  asCollection<M extends ODataModel<T>, C extends ODataCollection<T, M>>(
    entities: Partial<T>[] | {[name: string]: any}[],
    {annots, reset}: { annots?: ODataEntitiesAnnotations, reset?: boolean} = {}
  ): C {
    let schema = this.schema;
    if (annots?.type !== undefined) {
      schema = this.api.findStructuredTypeForType(annots.type);
    }
    const Collection = schema?.collection || ODataCollection;
    return new Collection(entities, {resource: this, annots, reset}) as C;
  }

  //#region Inmutable Resource
  key(key: EntityKey<T>) {
    const property = this.clone();
    key = (this.schema !== undefined && Types.isObject(key) && !isQueryCustomType(key)) ? this.schema.resolveKey(key as {[name: string]: any}) :
      (Types.isObject(key) && !isQueryCustomType(key)) ? Objects.resolveKey(key) : key;
    property.segment.property().key(key);
    return property;
  }

  value() {
    return ODataValueResource.factory<T>(this.api, this.type(), this.cloneSegments(), this.cloneQuery());
  }
  navigationProperty<N>(path: string) {
    let type = this.type();
    if (type !== undefined) {
      let parser = this.api.findParserForType<N>(type);
      type = parser instanceof ODataStructuredTypeParser?
        parser.typeFor(path) : undefined;
    }
    return ODataNavigationPropertyResource.factory<N>(this.api, path, type, this.cloneSegments(), this.cloneQuery());
  }
  property<P>(path: string) {
    let type = this.type();
    if (type !== undefined) {
      let parser = this.api.findParserForType<P>(type);
      type = parser instanceof ODataStructuredTypeParser?
        parser.typeFor(path) : undefined;
    }
    return ODataPropertyResource.factory<P>(this.api, path, type, this.cloneSegments(), this.cloneQuery());
  }

  select(opts: Select<T>) {
    const clone = this.clone();
    clone.query.select(opts);
    return clone;
  }

  expand(opts: Expand<T>) {
    const clone = this.clone();
    clone.query.expand(opts);
    return clone;
  }

  transform(opts: Transform<T>) {
    const clone = this.clone();
    clone.query.transform(opts);
    return clone;
  }

  search(opts: string) {
    const clone = this.clone();
    clone.query.search(opts);
    return clone;
  }

  filter(opts: Filter) {
    const clone = this.clone();
    clone.query.filter(opts);
    return clone;
  }

  orderBy(opts: OrderBy<T>) {
    const clone = this.clone();
    clone.query.orderBy(opts);
    return clone;
  }

  format(opts: string) {
    const clone = this.clone();
    clone.query.format(opts);
    return clone;
  }

  top(opts: number) {
    const clone = this.clone();
    clone.query.top(opts);
    return clone;
  }

  skip(opts: number) {
    const clone = this.clone();
    clone.query.skip(opts);
    return clone;
  }

  skiptoken(opts: string) {
    const clone = this.clone();
    clone.query.skiptoken(opts);
    return clone;
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
    return this.entitiesQueryHandler();
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

  //#region Shortcuts
  fetch(options?: HttpEntityOptions & { etag?: string }): Observable<ODataEntity<T>>;
  fetch(options?: HttpEntitiesOptions): Observable<ODataEntities<T>>;
  fetch(options?: HttpPropertyOptions): Observable<ODataProperty<T>>;
  fetch(options: HttpEntityOptions & HttpEntitiesOptions & HttpPropertyOptions & { etag?: string } = {}): Observable<any> {
    return this.get(options);
  }

  fetchProperty(options: HttpOptions & { etag?: string } = {}): Observable<T | null> {
    return this.fetch({ responseType: 'property', ...options}).pipe(map(({property}) => property));
  }

  fetchEntity(options: HttpOptions & { etag?: string } = {}): Observable<T | null> {
    return this.fetch({ responseType: 'entity', ...options}).pipe(map(({entity}) => entity));
  }

  fetchModel(options: HttpOptions & { etag?: string } = {}): Observable<ODataModel<T> | null> {
    return this.fetch({ responseType: 'entity', ...options}).pipe(map(({entity, annots}) => entity ? this.asModel(entity, {annots, reset: true}) : null));
  }

  fetchEntities(options: HttpOptions & { withCount?: boolean } = {}): Observable<T[] | null> {
    return this.fetch({ responseType: 'entities', ...options}).pipe(map(({entities}) => entities));
  }

  fetchCollection(options: HttpOptions & { withCount?: boolean } = {}): Observable<ODataCollection<T, ODataModel<T>> | null> {
    return this.fetch({ responseType: 'entities', ...options}).pipe(map(({entities, annots}) => entities ? this.asCollection(entities, { annots, reset: true }) : null));
  }

  fetchAll(options: HttpOptions = {}): Observable<T[]> {
    let res = this.clone();
    // Clean Paging
    res.query.clearPaging();
    let fetch = (opts?: { skip?: number, skiptoken?: string, top?: number }): Observable<ODataEntities<T>> => {
      if (opts) {
        res.query.paging(opts);
      }
      return res.get({responseType: 'entities', ...options});
    }
    return fetch()
      .pipe(
        expand(({annots: meta}) => (meta.skip || meta.skiptoken) ? fetch(meta) : EMPTY),
        concatMap(({entities}) => entities || []),
        toArray());
  }
  //#endregion
}
