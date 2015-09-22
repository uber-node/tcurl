struct Feckless {
    1: i32 ambiguity
}
struct Pong {
    1: bool pong
}
service Pinger {
    Pong ping()
}
