use crate::err;
use crate::error::Error;
pub use crate::methods::Method;
use crate::nodes::Node;
use crate::result::Result;

pub fn delegate<Params>(_method: Method, _params: Params) -> Result<Node> {
    todo!()
}
