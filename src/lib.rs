// Features

#[cfg(feature = "cli")]
pub mod cli;

#[cfg(feature = "request")]
pub mod request;

#[cfg(feature = "serve")]
pub mod serve;

#[cfg(any(feature = "request", feature = "serve"))]
pub mod delegate;
#[cfg(any(feature = "request", feature = "serve"))]
mod methods;
#[cfg(any(feature = "request", feature = "serve"))]
mod protocols;
#[cfg(any(feature = "request", feature = "serve"))]
mod rpc;

// Methods

//pub mod convert;
pub mod decode;
pub mod encode;
pub mod validate;

// Utilities

mod nodes;
