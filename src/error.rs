use std::fmt;

#[derive(Debug, PartialEq)]
pub enum Category {
    None,
    #[cfg(feature = "json")]
    Json,
    JsonSchema,
    #[cfg(feature = "yaml")]
    Yaml,
    NetworkAddress,
}

#[derive(Debug, PartialEq)]
pub struct Error {
    code: i16,
    category: Category,
    pub message: String,
}

impl From<&str> for Error {
    fn from(message: &str) -> Self {
        Error {
            code: 0,
            category: Category::None,
            message: message.to_string(),
        }
    }
}

impl From<String> for Error {
    fn from(message: String) -> Self {
        Error {
            code: 0,
            category: Category::None,
            message,
        }
    }
}

impl From<jsonschema::CompilationError> for Error {
    fn from(error: jsonschema::CompilationError) -> Self {
        Error {
            code: 0,
            category: Category::JsonSchema,
            message: error.to_string(),
        }
    }
}

#[cfg(feature = "json")]
impl From<serde_json::Error> for Error {
    fn from(error: serde_json::Error) -> Self {
        Error {
            code: 0,
            category: Category::Json,
            message: error.to_string(),
        }
    }
}

#[cfg(feature = "yaml")]
impl From<serde_yaml::Error> for Error {
    fn from(error: serde_yaml::Error) -> Self {
        Error {
            code: 0,
            category: Category::Yaml,
            message: error.to_string(),
        }
    }
}

impl From<std::net::AddrParseError> for Error {
    fn from(error: std::net::AddrParseError) -> Self {
        Error {
            code: 0,
            category: Category::NetworkAddress,
            message: error.to_string(),
        }
    }
}

impl fmt::Display for Error {
    fn fmt(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        write!(formatter, "Error: {}", self.message)
    }
}

#[macro_export]
macro_rules! err {
    ($($arg:tt)*) => {
        Err(Error::from(format!($($arg)*)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;

    #[test]
    fn display() {
        let error = Error::from("An error");
        assert_eq!(format!("{}", error), "Error: An error");
    }

    #[test]
    fn debug() {
        let error = Error::from("Another error");
        assert_eq!(
            format!("{:?}", error),
            "Error { code: 0, category: None, message: \"Another error\" }"
        );
    }

    #[test]
    fn from_str() {
        assert_eq!(
            Error::from("foo"),
            Error {
                code: 0,
                category: Category::None,
                message: "foo".to_string()
            }
        )
    }

    #[test]
    fn from_string() {
        assert_eq!(
            Error::from(format!("{}", "bar")),
            Error {
                code: 0,
                category: Category::None,
                message: "bar".to_string()
            }
        )
    }

    #[test]
    fn from_jsonschema_compilation_error() {
        assert_eq!(
            Error::from(jsonschema::CompilationError::SchemaError),
            Error {
                code: 0,
                category: Category::JsonSchema,
                message: "Schema compilation error".to_string()
            }
        )
    }

    #[test]
    fn from_json_error() {
        match serde_json::from_str::<serde_json::Value>("bad JSON") {
            Err(json_error) => {
                assert_eq!(
                    Error::from(json_error),
                    Error {
                        code: 0,
                        category: Category::Json,
                        message: "expected value at line 1 column 1".to_string()
                    }
                )
            }
            Ok(_) => panic!("Should error"),
        };
    }

    #[test]
    fn from_yaml_error() {
        match serde_yaml::from_str::<serde_yaml::Value>(": %") {
            Err(yaml_error) => {
                assert_eq!(
                    Error::from(yaml_error),
                    Error {
                        code: 0,
                        category: Category::Yaml,
                        message: "unexpected character: `%' at line 1 column 3".to_string()
                    }
                )
            }
            Ok(_) => panic!("Should error"),
        };
    }

    #[test]
    fn from_network_address_parse_error() {
        match "foo".parse() as std::result::Result<std::net::SocketAddr, std::net::AddrParseError> {
            Err(error) => {
                assert_eq!(
                    Error::from(error),
                    Error {
                        code: 0,
                        category: Category::NetworkAddress,
                        message: "invalid IP address syntax".to_string()
                    }
                )
            }
            Ok(_) => panic!("Should error"),
        };
    }
}
