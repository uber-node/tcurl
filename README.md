# tcurl

<!--
    [![build status][build-png]][build]
    [![Coverage Status][cover-png]][cover]
    [![Davis Dependency status][dep-png]][dep]
-->

<!-- [![NPM][npm-png]][npm] -->

A command line utility to talk to a tchannel server

```
tcurl -p host:port <service> <endpoint> [options]

  Options:
    -2 [data] send an arg2 blob
    -3 [data] send an arg3 blob
    --depth=n configure inspect printing depth
    -j print JSON
    -J [indent] print JSON with indentation
    -t [dir] directory containing Thrift files
```

## Installation

`npm install tcurl`

## Examples

### Thrift

For the purposes of these examples, let's assume that you have a TChannel
server listening on `localhost:1234`. The server registers handlers for the
thrift interface saved as `services/chamber.thrift` and defined as:

```thrift
struct EchoRequest {
  1: required string input;
}

service Chamber {
  string echo(
    1: required EchoRequest request;
  )
}
```

You could use TCurl to query this service by running:

`tcurl -p localhost:1234 chamber Chamber::echo -t ./services -3 '{"request": {"input": "foo"}}'

## NPM scripts

 - `npm run add-licence` This will add the licence headers.
 - `npm run cover` This runs the tests with code coverage
 - `npm run lint` This will run the linter on your code
 - `npm test` This will run the tests.
 - `npm run trace` This will run your tests in tracing mode.
 - `npm run travis` This is run by travis.CI to run your tests
 - `npm run view-cover` This will show code coverage in a browser

## Contributors

 - Raynos
 - ShanniLi

## MIT Licenced

  [build-png]: https://secure.travis-ci.org/uber/tcurl.png
  [build]: https://travis-ci.org/uber/tcurl
  [cover-png]: https://coveralls.io/repos/uber/tcurl/badge.png
  [cover]: https://coveralls.io/r/uber/tcurl
  [dep-png]: https://david-dm.org/uber/tcurl.png
  [dep]: https://david-dm.org/uber/tcurl
  [test-png]: https://ci.testling.com/uber/tcurl.png
  [tes]: https://ci.testling.com/uber/tcurl
  [npm-png]: https://nodei.co/npm/tcurl.png?stars&downloads
  [npm]: https://nodei.co/npm/tcurl
