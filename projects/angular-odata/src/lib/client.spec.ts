import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ODataClient } from './client';
import { ODataMetadataResource, ODataEntitySetResource, ODataFunctionResource, ODataActionResource, ODataSingletonResource, ODataEntityResource, ODataBatchResource, ODataResource } from './resources';
import { ODataModule } from './module';
import { ODataStructuredTypeParser } from './parsers';
import { HttpHeaders } from '@angular/common/http';
import { TripPinConfig, Person, NAMESPACE, SERVICE_ROOT } from './trippin.spec';
import { ODataStructuredType } from './schema';
import { Http } from './utils';

describe('ODataClient', () => {
  let client: ODataClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ODataModule.forRoot(TripPinConfig), HttpClientTestingModule]
    });

    client = TestBed.inject<ODataClient>(ODataClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should return undefined parser for resource', () => {
    const set: ODataResource<Person> = client.entitySet<Person>('People');
    const api = client.apiFor(set);
    const parser = api.findParserForType<Person>("Foo") as ODataStructuredTypeParser<Person>;
    expect(parser).toBeUndefined();
  });

  it('should return person parser for resource', () => {
    const set: ODataResource<Person> = client.entitySet<Person>('People', `${NAMESPACE}.Person`);
    const api = client.apiFor(set);
    const parser = api.findParserForType<Person>(set.type() as string) as ODataStructuredTypeParser<Person>;
    expect(parser instanceof ODataStructuredTypeParser).toBeTruthy();
  });

  it('should throw error parser for type', () => {
    expect(function() {
      client.parserForType<Person>(`${NAMESPACE}.Foo`);
    }).toThrow(new Error("No Parser for type TripPin.Foo was found"));
  });

  it('should throw error entity config', () => {
    expect(function() {
      client.enumTypeForType<Person>(`${NAMESPACE}.Foo`);
    }).toThrow(new Error("No Enum for type TripPin.Foo was found"));
  });

  it('should throw error entity config', () => {
    expect(function() {
      client.structuredTypeForType<Person>(`${NAMESPACE}.Foo`);
    }).toThrow(new Error("No Structured for type TripPin.Foo was found"));
  });

  it('should return person parser for type', () => {
    const parser = client.parserForType<Person>(`${NAMESPACE}.Person`);
    expect(parser instanceof ODataStructuredTypeParser).toBeTruthy();
  });

  it('should return person entity config', () => {
    const config = client.structuredTypeForType<Person>(`${NAMESPACE}.Person`);
    expect(config instanceof ODataStructuredType).toBeTruthy();
  });

  it('should create metadata resource', () => {
    const metadata: ODataMetadataResource = client.metadata();
    expect(metadata.endpointUrl()).toEqual(SERVICE_ROOT + '$metadata');
  });

  it('should create batch resource', () => {
    const batch: ODataBatchResource = client.batch();
    expect(batch.endpointUrl()).toEqual(SERVICE_ROOT + '$batch');
  });

  it('should create singleton resource', () => {
    const singleton: ODataSingletonResource<Person> = client.singleton<Person>('Me');
    expect(singleton.endpointUrl()).toEqual(SERVICE_ROOT + 'Me');
  });

  it('should create entitySet resource', () => {
    const set: ODataEntitySetResource<Person> = client.entitySet<Person>('People');
    expect(set.endpointUrl()).toEqual(SERVICE_ROOT + 'People');
  });

  it('should create unbound function resource', () => {
    const fun: ODataFunctionResource<any, any> = client.function<any, any>("NS.MyFunction")
    expect(fun.endpointUrl()).toEqual(SERVICE_ROOT + 'NS.MyFunction');
  });

  it('should create unbound action resource', () => {
    const act: ODataActionResource<any, any> = client.action<any, any>("NS.MyAction")
    expect(act.endpointUrl()).toEqual(SERVICE_ROOT + 'NS.MyAction');
  });

  it('should return parser for resource', () => {
    const set: ODataResource<Person> = client.entitySet<Person>('People', `${NAMESPACE}.Person`);
    const api = client.apiFor(set);
    const parser = api.findParserForType<Person>(set.type() as string) as ODataStructuredTypeParser<Person>;
    expect(parser instanceof ODataStructuredTypeParser).toBeTruthy();
    expect(parser.fields.length).toEqual(9);
  });

  it('should convert resource to json', () => {
    const set: ODataEntitySetResource<Person> = client.entitySet<Person>('People', `${NAMESPACE}.Person`);
    const func = set.function<any, any>("NS.MyFunction");
    const json = func.toJSON();
    expect(json).toEqual({ segments: [{ name: 'entitySet', path: 'People', type: 'TripPin.Person' }, { name: 'function', path: 'NS.MyFunction' }], options: {}});
  });

  it('should merge headers', () => {
    const headers = Http.mergeHttpHeaders({
      'Content-Type': 'application/json'
    }, {
      Authorization: 'Bearer token',
      'Content-Type': '*/*'
    });
    expect(headers.get('Authorization')).toEqual("Bearer token");
    expect(headers.getAll('Content-Type')).toEqual(['application/json', '*/*']);
  });

  it('should merge params', () => {
    const params = Http.mergeHttpParams({
      param1: 'value1',
      param2: 'value2',
      params: ['value1']
    }, {
      param3: 'value3',
      params: ['value2', 'value3', 'value4'],
    }, {
      params: ['value5', 'value6'],
      param4: 'value4'
    });
    expect(params.toString()).toEqual('param1=value1&param2=value2&params=value1&params=value2&params=value3&params=value4&params=value5&params=value6&param3=value3&param4=value4');
  });

  it('should fetch people', () => {
    const dummyPeople = [
        {
          "@odata.id": "http://services.odata.org/V4/TripPinServiceRW/People('russellwhyte')",
          "@odata.etag": "W/\"08D814450D6BDB6F\"",
          "UserName": "russellwhyte", "FirstName": "Russell", "LastName": "Whyte",
          "Emails": [
            "Russell@example.com",
            "Russell@contoso.com"
          ]
        },
        {
          "@odata.id": "http://services.odata.org/V4/TripPinServiceRW/People('scottketchum')",
          "@odata.etag": "W/\"08D814450D6BDB6F\"",
          "UserName": "scottketchum", "FirstName": "Scott", "LastName": "Ketchum",
          "Emails": [
            "Scott@example.com"
          ]
        }
      ];
    const data = {
      "@odata.context": "http://services.odata.org/V4/TripPinServiceRW/$metadata#People",
      "value": dummyPeople
    };
    client.entitySet<Person>('People', `${NAMESPACE}.Person`)
    .top(2)
    .get().subscribe(({entities, annots: meta}) => {
      expect(entities !== null).toBeTrue();
      expect((entities as any[]).length).toBe(2);
      expect(meta.context.entitySet).toEqual("People");
      expect(entities).toEqual(dummyPeople);
    });

    const req = httpMock.expectOne(`${SERVICE_ROOT}People?$top=2`);
    expect(req.request.method).toBe("GET");
    req.flush(data);
  });

  it('should fetch person', () => {
    const dummyPerson = {
      "UserName": "russellwhyte", "FirstName": "Russell", "LastName": "Whyte",
      "Emails": [
        "Russell@example.com",
        "Russell@contoso.com"
      ]
    };
    const data = Object.assign({}, dummyPerson, {
      "@odata.context":"http://services.odata.org/V4/TripPinServiceRW/$metadata#People/$entity",
      "@odata.id": "http://services.odata.org/V4/TripPinServiceRW/People('russellwhyte')",
      "@odata.etag": "W/\"08D814450D6BDB6F\"",
    });
    const entity: ODataEntityResource<Person> = client.entitySet<Person>('People', `${NAMESPACE}.Person`).entity('russellwhyte');

    entity.get().subscribe(({entity, annots: meta}) => {
      expect(meta.context.entitySet).toEqual("People");
      expect(meta.etag).toEqual('W/"08D814450D6BDB6F"');
      expect(entity).toEqual(data);
    });

    const req = httpMock.expectOne(`${SERVICE_ROOT}People('russellwhyte')`);
    expect(req.request.method).toBe("GET");
    req.flush(data);
  });

  it('should execute batch', () => {
    const payload = {
      "@odata.context":"http://services.odata.org/V4/TripPinServiceRW/$metadata#People/$entity",
      "@odata.id": "http://services.odata.org/V4/TripPinServiceRW/People('russellwhyte')",
      "@odata.etag": "W/\"08D814450D6BDB6F\"",
      "UserName": "russellwhyte", "FirstName": "Russell", "LastName": "Whyte",
      "Emails": [
        "Russell@example.com",
        "Russell@contoso.com"
      ]
    };
    const data = `--batchresponse_6520643b-3c13-4889-aa60-b4422cf2b82b
Content-Type: application/http
Content-Transfer-Encoding: binary

HTTP/1.1 200 OK
Content-Type: application/json; odata.metadata=minimal
OData-Version: 4.0

${JSON.stringify(payload)}
--batchresponse_6520643b-3c13-4889-aa60-b4422cf2b82b--`;
    const entity: ODataEntityResource<Person> = client.entitySet<Person>('People', `${NAMESPACE}.Person`).entity('russellwhyte');
    client.batch().post((batch) => {
      expect(batch.endpointUrl()).toEqual(SERVICE_ROOT + '$batch');
      entity.get().subscribe(({annots: meta}) => {
        expect(meta.context.entitySet).toEqual("People");
        expect(meta.etag).toEqual('W/"08D814450D6BDB6F"');
      });
    }).subscribe();

    const headers = new HttpHeaders({
      'Content-Length': data.length.toString(),
      'Content-Type': 'multipart/mixed; boundary=batchresponse_6520643b-3c13-4889-aa60-b4422cf2b82b'
    });
    const req = httpMock.expectOne(`${SERVICE_ROOT}$batch`);
    expect(req.request.method).toBe("POST");
    req.flush(data, {headers});
  });
});
