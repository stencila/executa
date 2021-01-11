use anyhow::Result;
use executa::{
    methods::Method, nodes::Node, protocols::Protocol, request::request, rpc::Error, rpc::Response,
    serve::serve,
};
use pretty_assertions::assert_eq;

#[tokio::test]
async fn http() -> Result<()> {
    let (_join_handle, stop_signal) = serve(Some(Protocol::Http), None, None)?;

    let client: reqwest::Client = reqwest::Client::new();

    // Using a plain POST

    let response = client
        .post("http://127.0.0.1:9000")
        .json(&serde_json::json!({
            "method": "decode",
            "params": {
                "input": "\"Hello world\"",
                "from": "json"
            }
        }))
        .send()
        .await?
        .json::<Response>()
        .await?;

    assert_eq!(
        response,
        Response::new(None, Some(Node::String("Hello world".to_string())), None)
    );

    let response = client
        .post("http://127.0.0.1:9000")
        .json(&serde_json::json!({
            "method": "decode"
        }))
        .send()
        .await?
        .json::<Response>()
        .await?;

    assert_eq!(
        response,
        Response {
            error: Some(Error {
                code: -32700,
                message: "Request body deserialize error: missing field `params`".to_string()
            }),
            ..Default::default()
        }
    );

    // Using a "wrapped" POST...

    let response = client
        .post("http://127.0.0.1:9000/decode")
        .json(&serde_json::json!({
            "input": "\"Hello world\"",
            "from": "json"
        }))
        .send()
        .await?
        .json::<serde_json::Value>()
        .await?;

    assert_eq!(response, Node::String("Hello world".to_string()));

    // Using our own method

    let response = request(
        "http://127.0.0.1:9000".to_string(),
        Method::Decode,
        serde_json::json!({
            "input": "\"This is easier!\"",
            "from": "json"
        }),
    )
    .await?;

    assert_eq!(response, Node::String("This is easier!".to_string()));

    stop_signal.send(());

    Ok(())
}
