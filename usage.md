# tcurl(1) -- curl for tchannel

## SYNOPSIS

`tcurl` <service> <endpoint> <options>

Options:
  -h --help                 Show detailed manpage
  -v --version              Print version
  -H --hostlist             Path to hostlist file
  -p --peer                 IP and port of single peer
  -t --thrift               Path to thrift IDL file
  -2 --head <value>         Set header to <value>
  -3 --body <value>         Set body to <value>
     --http <method>        Use HTTP <method> instead of TCP
     --health               Print health for <service>
     --raw                  Send header and body as binary diaray
     --shardKey             Send Ringpop shardKey transport header
     --no-strict            Parse thrift IDL files loosely
     --timeout <value>      Set a timeout value in milliseconds

## DESCRIPTION

`tcurl` is a tool for constructing and sending requests to a tchannel service.
It supports Thrift, JSON, and raw request format.

## EXAMPLES

 - `tcurl -p localhost:8080 serviceName --health`
 - `tcurl -p 127.0.0.1:21300 hyperbahn Hyperbahn::discover -t ./hyperbahn.thrift -3 '{"query":{"serviceName":"ringpop"}}'`
 - `tcurl -p localhost:8080 serviceName endpoint --raw -3 'message'`

## OPTIONS

`-v | --version`
    Print the current version.

`-p | --peer host:port serviceName <endpoint>`
    Specify the destination where the request should be sent to including the
    host, the port, the serviceName, and the endpoint. When used with --health,
    endpoint is not required.

`-H | --hostfile </path/to/hostfile> <serviceName> <endpoint>`
    Similar to the `-p` option. Instead of the host:port, it takes a host-file
    that contains a list of host:port where this request can be sent to.
    TChannel will only pick one host:port to send the request to. An example
    hostfile with two hyperbahn hosts:
    ```
    [
        "127.0.0.1:21300",
        "127.0.0.1:21301"
    ]
    ```

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

`-t | --thrift </path/to/thrift/file>`
    Used with the thrift encoding to specify the path to the thrift files. The
    thrift option value can either point to a file or a directory.
    For example:
    ```
    tcurl -p 127.0.0.1:21300 serviceName Meta::health -t . -3 null
    ```
    The above command assumes that current folder contains the meta.thrift IDL
    file. The endpoint specified at the command line should be defined in the
    specified thrift file. Using the example immediatly above, the following
    would be a valid request:
    ```
    tcurl hyperbahn Hyperbahn::DiscoveryResult --body '{ "serviceName": "ringpop" }' `--thrift ./idl/hyperbahn.thrift

`--no-strict`
    Disable the default strict mode of thrift parsing. When strict mode is
    enabled, all fields must be specified as either "required" or "optional".

`--raw`
    Use raw format (i.e. plain text) for request.

`--http method`
    Send an http request described in the form of tchannel.
    For example:
    ```
    tcurl -p 127.0.0.1:21300 echoServer '/echo' --http 'POST' --head '{"Accept": "text/plain"}' --body '"hello world!"'
    ```

`--timeout value`
    Specify the maximum time in milliseconds this request can take
    until it timeout. 
    For example, the following command specifies a timeout value
    of one second:
    ```
    tcurl -p 127.0.0.1:8080 serviceName endpoint --timeout 1000 
    ```

`--shardKey`
    Ringpop only. Send ringpop shardKey transport header.

`--config`
    Path to a JSON or ini-style configuration file with values for any
    of the configurable keys above.

`--helpUrl`
    A url string that is printed along with usage information. This feature
    exists for organizations using tcurl, tchannel and hyperbahn to provide a
    URL to a help document specific to how they use tcurl. This option should
    not be specified as a command line flag and should instead be specified
    in a tcurlrc file.

## Configuration (command line flags, environment variables and tcurlrc)

`tcurl` supports getting its configuration from command line arguments,
environment variables and tcurlrc files (in that order).

The command line options are listed above. Environment variables should
be prefixed with TCURL_ and the key in UPPER_SNAKE_CASE. e.g.
    ```
    TCURL_HOSTFILE=/path/to/hostfile.json
    TCURL_NO_STRICT=true
    ```

After giving precedence to command line arguments and environment
variables it will probe the following JSON or ini-style configuration
files in order of highest precedence to lowest.
 - a tcurlrc specified with the --config flag.
 - a local .tcurlrc in the current working directory or the first one
 found looking in ./ ../ ../../ ../../../ etc.
 - $HOME/.tcurlrc
 - $HOME/.tcurl/config
 - $HOME/.config/tcurl
 - $HOME/.config/tcurl/config
 - /etc/tcurlrc
 - /etc/tcurl/config

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
