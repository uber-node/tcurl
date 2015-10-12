# tcurl(1) -- curl for tchannel

## SYNOPSIS

`tcurl` [--help] [-v | --version] [-H] [-p] [-t]
        [-2 | --arg2 | --head] [-3 | --arg3 | --body]
        [--shardKey] [--no-strict] [--timeout]
        [--http] [--raw] [--health]
        [--rate] [--requests] [--time] [--delay]

## DESCRIPTION

`tcurl` is a tool for constructing and sending requests to
a tchannel service. It supports thrift, JSON, and raw request format.

## EXAMPLES

 - `tcurl -p localhost:8080 serviceName --health`
 - `tcurl -p 127.0.0.1:21300 hyperbahn Hyperbahn::discover -t ./hyperbahn.thrift -3 '{"query":{"serviceName":"ringpop"}}'`
 - `tcurl -p localhost:8080 serviceName endpoint --raw -3 'message'`

## OPTIONS

`-v | --version`
    Print the current version.

`-p host:port serviceName [endpoint]`
    Specify the destination where the request should be sent to
    including the host, the port, the serviceName, and the endpoint.
    When used with --health, endpoint is not required.

`-H host-file serviceName [endpoint]`
    Similar to the `-p` option. Instead of the host:port, it takes a host-file
    that contains a list of host:port where this request can be sent to.
    TChannel will only pick one host:port to send the request to.

`--health`
    Send a health check request to a sevice that implements the "Meta::health"
    health check endpoint.
    For example:
    ```
    tcurl -p 127.0.0.1:21300 serviceName --heath
    ```
    It is the same as:
    ```
    tcurl -p 127.0.0.1:21300 serviceName Meta::health -t meta.thrift
    ```

`-2 | --arg2 | --head content`
    Specify the head (a.k.a. arg2) of the request. The content can be either a
    raw string or a JSON string depending on the request format.

`-3 | --arg3 | --body content`
    Specify the body (a.k.a. arg3) of the request. The content can be either a
    raw string or a JSON string depending on the request format.

    An example of a JSON string would be
    ```
    '{"query":{"serviceName":"ringpop"}}',
    ```

    where the corresponding thrift IDL format is:
    ```
    struct DiscoveryQuery {
      1: required string serviceName
    }

    service Hyperbahn {
        DiscoveryResult discover(
            1: required DiscoveryQuery query
        )
    }
    ```

`-t thrift`
    Used with the thrift encoding to specify the path to the thrift files.
    The thrift option value can either point to a file or a directory.
    For example:
    ```
    tcurl -p 127.0.0.1:21300 serviceName Meta::health -t . -3 null
    ```
    The above command assumes that current folder contains the meta.thrift IDL file.

`--no-strict`
    Disable the default strict mode of thrift parsing. When strict mode is enabled,
    all fields must be specified as either "required" or "optional".

`--raw`
    Use raw format (i.e. plain text) for request.

`--http method`
    Send an http request described in the form of tchannel.
    For example:
    ```
    tcurl -p 127.0.0.1:21300 echoServer '/echo' --http 'POST' --head '{"Accept": "text/plain"}' --body '"hello world!"'
    ```

`--timeout value`
    Specify the maximum time in miniseconds this request can take
    until it timeout. 
    For example, the following command specifies a timeout value
    of one second:
    ```
    tcurl -p 127.0.0.1:8080 serviceName endpoint --timeout 1000 
    ```

`--rate value`
    This option is required in order to use the benchmark mode,
    where the same request is sent multiple times to the server.
    It specifies the number of requests sent at each batch.
    For example, the following command sends health check requests to a
    service at the rate of 1000, i.e., send 1000 requests and wait
    until the requests all complete before sending the next 1000.
    ```
    tcurl -p localhost:8080 serviceName --health --rate 1000 
    ```

`--delay value`
    Specify the time in milliseconds it should delay between each batch.
    For example, the following command delays 100ms between each batch send.
    ```
    tcurl -p localhost:8080 serviceName --health --rate 1000 --delay 100
    ```

`--requests value`
    Specify the total number of requests that can be sent in
    benchmark mode. By default, there is no limit on the number of
    requests that can be sent.

`--time value`
    Specify the time in milliseconds how long the benchmark should run.
    By default, there is no limit on the time length.


## EXIT CODES
 - `0: for all successful requests`
 - `1: timeout`
 - `2: cancelled`
 - `3: busy`
 - `4: declined`
 - `5: unexpected error`
 - `6: bad request`
 - `7: network error`
 - `8: unhealthy (broken circuit)`
 - `124: unhealthy / not OK thrift response`
 - `125: misc tcurl / tchannel internal error`
 - `126: response not ok error`
 - `127: fatal protocol error`


## BUGS

Please report any bugs to https://github.com/uber/tcurl

## LICENCE

MIT Licenced

## SEE ALSO

 - `TChannel: https://github.com/uber/tchannel`
 - `Hyperbahn: https://github.com/uber/hyperbahn`
 - `Ringpop: https://github.com/uber/ringpop-node`
