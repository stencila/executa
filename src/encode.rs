use crate::delegate::delegate;
use crate::err;
use crate::error::Error;
use crate::methods::Method;
use crate::nodes::Node;
use crate::result::Result;

pub fn encode(node: Node, format: &str) -> Result<Node> {
    let content = match format {
        #[cfg(feature = "json")]
        "json" => serde_json::to_string(&node)?,
        #[cfg(feature = "yaml")]
        "yaml" => serde_yaml::to_string(&node)?,
        _ => return delegate(Method::Encode, ()),
    };

    #[allow(unreachable_code)]
    Ok(Node::String(content))
}
