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
  const [actions, setActions] = useState<Action[]>([]);
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

  const handleAction = (action: Action) => {
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
        <br></br>
        <textarea
          style={{ resize: "none", width: "80%", height: "30px" }}
          value={contractAddressText}
          onChange={(event) => setContractAddressText(event.target.value)}
        />
      </label>
      <label>
        ABI Form
        <br></br>
        <textarea
          style={{ resize: "none", width: "80%", height: "100px" }}
          value={abiText}
          onChange={(event) => setABIText(event.target.value)}
        />
      </label>
      <Button onClick={handleSetABI}>Interact</Button>
      {abi && contractAddress ? (
        <>
          <div>
            <ABIUnwrapForm handleJoinSplitRequest={handleJoinSplitRequest} />
            <p>Currently unwrapping the following tokens and amounts:</p>
            <ol>
              {joinSplitRequests.map(({ asset, unwrapValue }, index) => (
                <li key={index}>
                  Asset Address: {asset.assetAddr}, type:{" "}
                  {asset.assetType.toString()} Amount: {unwrapValue.toString()}
                </li>
              ))}
            </ol>
          </div>
          <div>
            <ABIRefundAssetsForm handleNewRefundAsset={handleRefundAsset} />
            <p>Currently set to produce the following output tokens:</p>
            <ol>
              {refundAssets.map((refundAsset, index) => (
                <li key={index}>{refundAsset.assetAddr}</li>
              ))}
            </ol>
          </div>
          <div>
            <p>Currently set to perform the following actions:</p>
            <ol>
              {actions.map(({ contractAddress, encodedFunction }, index) => (
                <li key={index}>
                  Target: {contractAddress}, encodedFunction: {encodedFunction}
                </li>
              ))}
            </ol>
            <ABIInteractionForm
              handleAction={handleAction}
              abi={abi}
              contractAddress={contractAddress}
            />
          </div>
          <div>
            <Button onClick={submitOperation}>
              <h3>Go</h3>
            </Button>
          </div>
        </>
      ) : (
        <></>
      )}
    </>
  );
};
