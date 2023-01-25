import React, { useContext, useState } from "react";
import { ABIInteractionForm } from "./ABIInteractionForm";
import { ABIItem, tryParseABI } from "../utils/abiParser";
import { Button } from "./Buttons";
import * as ethers from "ethers";
import { NocturneFrontendSDK } from "@nocturne-xyz/frontend-sdk";
import {
  Action,
  Asset,
  JoinSplitRequest,
  OperationRequest,
} from "@nocturne-xyz/sdk";
import { ABIUnwrapForm } from "./ABIUnwrapForm";
import { ABIRefundAssetsForm } from "./ABIRefundAssetsForm";
import { MetaMaskContext, MetamaskActions } from "../hooks";
import { formatAbbreviatedAddress } from "../utils/formatting";

export interface ExtendedAction extends Action {
  signature: string;
}

export type ABIFormProps = {
  sdk: NocturneFrontendSDK;
};

export const ABIForm = ({ sdk }: ABIFormProps) => {
  const [abiText, setABIText] = useState("");
  const [contractAddressText, setContractAddressText] = useState("");
  const [abi, setABI] = useState<ABIItem[] | undefined>(undefined);
  const [contractAddress, setContractAddress] = useState<string | undefined>(
    undefined
  );
  const [actions, setActions] = useState<ExtendedAction[]>([]);
  const [joinSplitRequests, setJoinSplitRequests] = useState<
    JoinSplitRequest[]
  >([]);
  const [refundAssets, setRefundAssets] = useState<Asset[]>([]);
  const [_state, dispatch] = useContext(MetaMaskContext);

  const handleSetABI = (event: any) => {
    event.preventDefault();
    // validate contract address
    if (!ethers.utils.isAddress(contractAddressText)) {
      alert("Invalid contract address");
      return;
    }

    setContractAddress(contractAddressText);

    // parse ABI
    const abi = tryParseABI(abiText);
    console.log("abi:", abi);
    if (abi === undefined) {
      alert("Invalid ABI");
      return;
    }
    setABI(abi);
  };

  const handleAction = (action: ExtendedAction) => {
    setActions([...actions, action]);
  };

  const handleJoinSplitRequest = (joinSplitRequest: JoinSplitRequest) => {
    setJoinSplitRequests([...joinSplitRequests, joinSplitRequest]);
  };

  const handleRefundAsset = (refundAsset: Asset) => {
    setRefundAssets([...refundAssets, refundAsset]);
  };

  const submitOperation = async () => {
    const operationRequest: OperationRequest = {
      joinSplitRequests,
      refundAssets,
      actions,
    };

    console.log("Operation request:", operationRequest);
    try {
      const provenOperation = await sdk.generateProvenOperation(
        operationRequest
      );
      console.log("Proven operation:", provenOperation);
      // TODO: submit bundle to bundler
    } catch (e) {
      console.error("error: ", e);
      dispatch({ type: MetamaskActions.SetError, payload: e });
    }
  };

  return (
    <>
      <label>
        Contract Address
        <br />
        <textarea
          style={{ resize: "none", width: "70%", height: "30px" }}
          value={contractAddressText}
          onChange={(event) => setContractAddressText(event.target.value)}
        />
      </label>
      <label>
        ABI Form
        <br />
        <textarea
          style={{ resize: "none", width: "70%", height: "100px" }}
          value={abiText}
          onChange={(event) => setABIText(event.target.value)}
        />
      </label>
      <Button onClick={handleSetABI}>Interact</Button>
      {abi && contractAddress ? (
        <>
          <br />
          <hr style={{ border: "0.25px solid white", width: "100%" }} />
          <div>
            <ABIUnwrapForm handleJoinSplitRequest={handleJoinSplitRequest} />
            <p>Currently unwrapping the following tokens and amounts...</p>
            {
              <table>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Address</th>
                    <th style={{ textAlign: "left" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {joinSplitRequests.map(({ asset, unwrapValue }) => (
                    <tr key={asset.assetAddr}>
                      <td
                        style={{
                          textAlign: "left",
                          color: "#ADD8E6",
                          cursor: "pointer",
                          paddingRight: "50px",
                        }}
                      >
                        {formatAbbreviatedAddress(asset.assetAddr)}
                      </td>
                      <td style={{ textAlign: "left" }}>
                        {unwrapValue.toString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          </div>

          <div>
            <br />
            <hr style={{ border: "0.25px solid white", width: "100%" }} />
            <ABIRefundAssetsForm handleNewRefundAsset={handleRefundAsset} />
            <p>Currently set to produce the following output tokens...</p>
            {
              <table>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Address</th>
                  </tr>
                </thead>
                <tbody>
                  {refundAssets.map(({ assetAddr }) => (
                    <tr key={assetAddr}>
                      <td
                        style={{
                          textAlign: "left",
                          color: "#ADD8E6",
                          cursor: "pointer",
                          paddingRight: "50px",
                        }}
                      >
                        {formatAbbreviatedAddress(assetAddr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          </div>
          <div>
            <br />
            <hr style={{ border: "0.25px solid white", width: "100%" }} />
            <h1 style={{ fontSize: "20px" }}>Contract Actions</h1>
            <ABIInteractionForm
              handleAction={handleAction}
              abi={abi}
              contractAddress={contractAddress}
            />
          </div>
          <p>Currently set to perform the following actions:</p>
          {
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Target</th>
                  <th style={{ textAlign: "left" }}>Call</th>
                </tr>
              </thead>
              <tbody>
                {actions.map(
                  ({ contractAddress, encodedFunction, signature }) => (
                    <tr key={encodedFunction}>
                      <td
                        style={{
                          textAlign: "left",
                          color: "#ADD8E6",
                          cursor: "pointer",
                          paddingRight: "50px",
                        }}
                      >
                        {formatAbbreviatedAddress(contractAddress)}
                      </td>
                      <td style={{ textAlign: "left", overflow: "hidden" }}>
                        <div
                          style={{ maxWidth: "200px", wordWrap: "break-word" }}
                        >
                          <p>{signature}</p>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          }
          <br />
          <div>
            <Button onClick={submitOperation}>
              <h1 style={{ fontSize: "16px" }}>Submit Operation</h1>
            </Button>
          </div>
        </>
      ) : (
        <></>
      )}
    </>
  );
};
