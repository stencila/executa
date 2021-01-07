use crate::delegate::delegate;
use crate::methods::Method;
use crate::nodes::Node;
use crate::result::Result;

struct Params {
    node: Node,
}

fn coerce_params(params: Params) -> Result<Node> {
    let Params { node } = params;
    coerce(node)
}

pub fn coerce(node: Node) -> Result<Node> {
    delegate(Method::Coerce, Params { node })
}
