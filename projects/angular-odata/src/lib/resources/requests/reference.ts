import { Observable } from 'rxjs';

import { ODataResource } from '../resource';
import { ODataPathSegments, PathSegmentNames } from '../path-segments';
import { ODataQueryOptions } from '../query-options';
import { ODataClient } from '../../client';
import { ODataEntityResource } from './entity';
import { $REF as $REFERENCE, ODATA_ID, $ID } from '../../types';
import { HttpOptions } from '../http-options';

export class ODataReferenceResource extends ODataResource<any> {
  //#region Factory
  static factory<P>(client: ODataClient, segments: ODataPathSegments, options: ODataQueryOptions) {
    segments.segment(PathSegmentNames.reference, $REFERENCE);
    options.clear();
    return new ODataReferenceResource(client, segments, options);
  }

  clone() {
    return super.clone<ODataReferenceResource>();
  }
  //#endregion

  //#region Requests
  post(target: ODataEntityResource<any>, options?: HttpOptions): Observable<any> {
    let related = this.client.endpointUrl(target);
    return super.post({[ODATA_ID]: related},
      Object.assign<HttpOptions, HttpOptions>(<HttpOptions>{responseType: 'json'}, options || {})
    );
  }

  put(target: ODataEntityResource<any>, options?: HttpOptions & { etag?: string }): Observable<any> {
    let related = this.client.endpointUrl(target);
    return super.put({[ODATA_ID]: related},
      Object.assign<HttpOptions, HttpOptions>(<HttpOptions>{responseType: 'json'}, options || {})
    );
  }

  delete(options?: HttpOptions & { etag?: string, target?: ODataEntityResource<any> }): Observable<any> {
    if (options && options.target) {
      let related = this.client.endpointUrl(options.target);
      this.custom({[$ID]: related});
    }
    return super.delete(
      Object.assign<HttpOptions, HttpOptions>(<HttpOptions>{responseType: 'json'}, options || {})
    );
  }
  //#endregion

  //#region Custom for collections
  add(target: ODataEntityResource<any>, options?: HttpOptions): Observable<any> {
    return this.post(target, options);
  }

  remove(target?: ODataEntityResource<any>, options?: HttpOptions): Observable<any> {
    return this.delete(Object.assign({target}, options));
  }
  //#region 

  //#region Custom for single
  set(target: ODataEntityResource<any>, options?: HttpOptions & { etag?: string }): Observable<any>  {
    return this.put(target, options);
  }

  unset(options?: HttpOptions & { etag?: string }): Observable<any>  {
    return this.delete(options);
  }
  //#region 
}
