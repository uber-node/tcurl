namespace java com.uber.thrift.thriftrw

struct User {
    1: required string name
}

service UsersBase {
    User getUser(1: string name)
}
