import { useContext, useEffect, useState } from "react";
import styled from "styled-components";
import { MetamaskActions, MetaMaskContext } from "../hooks";
import { shouldDisplayReconnectButton } from "../utils";
import { InstallFlaskButton, Card, ABIForm } from "../components";
import {
  loadNocturneFrontendSDK,
  NocturneFrontendSDK,
  AssetBalancesDisplay,
  DepositForm,
} from "@nocturne-xyz/frontend-sdk";
import { DEPOSIT_MANAGER_CONTRACT_ADDRESS } from "../config";
import { BUNDLER_ENDPOINT } from "../config/bundler";

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  margin-top: 7.6rem;
  margin-bottom: 7.6rem;
  ${({ theme }) => theme.mediaQueries.small} {
    padding-left: 2.4rem;
    padding-right: 2.4rem;
    margin-top: 2rem;
    margin-bottom: 2rem;
    width: auto;
  }
`;

const CardContainer = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-between;
  max-width: 64.8rem;
  width: 100%;
  height: 100%;
  margin-top: 1.5rem;
`;

const ErrorMessage = styled.div`
  background-color: ${({ theme }) => theme.colors.error.muted};
  border: 1px solid ${({ theme }) => theme.colors.error.default};
  color: ${({ theme }) => theme.colors.error.alternative};
  border-radius: ${({ theme }) => theme.radii.default};
  padding: 2.4rem;
  margin-bottom: 2.4rem;
  margin-top: 2.4rem;
  max-width: 60rem;
  width: 100%;
  ${({ theme }) => theme.mediaQueries.small} {
    padding: 1.6rem;
    margin-bottom: 1.2rem;
    margin-top: 1.2rem;
    max-width: 100%;
  }
`;

const Playground = () => {
  const [state, dispatch] = useContext(MetaMaskContext);
  const [nocturneFrontendSDK, setFrontendSDK] = useState<NocturneFrontendSDK>();

  useEffect(() => {
    loadNocturneFrontendSDK(
      BUNDLER_ENDPOINT,
      DEPOSIT_MANAGER_CONTRACT_ADDRESS
    ).then((sdk) => {
      console.log("instantiated frontend sdk");
      setFrontendSDK(sdk);
    });
  }, [loadNocturneFrontendSDK, state.installedSnap]);

  const sync = async () => {
    try {
      await nocturneFrontendSDK!.sync();
    } catch (e) {
      console.error(e);
      dispatch({ type: MetamaskActions.SetError, payload: e });
    }
  };

  useEffect(() => {
    const timeout = setInterval(async () => {
      if (!nocturneFrontendSDK) return;
      console.log("syncing and leaves...");
      await sync();
    }, 20_000);

    return () => clearTimeout(timeout);
  }, [nocturneFrontendSDK]);

  return (
    <Container>
      <CardContainer>
        {state.error && (
          <ErrorMessage>
            <b>An error happened:</b> {state.error.message}
          </ErrorMessage>
        )}
        {!state.isFlask && (
          <Card
            content={{
              title: "Install",
              description:
                "Snaps is pre-release software only available in MetaMask Flask, a canary distribution for developers with access to upcoming features.",
            }}
            fullWidth
          >
            <InstallFlaskButton />
          </Card>
        )}
        {shouldDisplayReconnectButton(state.installedSnap) && (
          <Card
            content={{
              title: "Deposit",
              description: "Deposit assets into your Nocturne private account",
            }}
          >
            {nocturneFrontendSDK && <DepositForm sdk={nocturneFrontendSDK} />}
          </Card>
        )}
        {shouldDisplayReconnectButton(state.installedSnap) && (
          <Card
            content={{
              title: "Asset Balances",
              description: "Balances for each asset",
            }}
            disabled={!state.installedSnap}
          >
            <AssetBalancesDisplay frontendSDK={nocturneFrontendSDK} />
          </Card>
        )}
      </CardContainer>
      {shouldDisplayReconnectButton(state.installedSnap) && (
        <CardContainer>
          <Card
            content={{
              title: "Contract Interaction",
              description:
                "Interact with the contract by pasting its ABI below",
            }}
            fullWidth
          >
            {nocturneFrontendSDK && (
              <ABIForm
                sdk={nocturneFrontendSDK}
                bundlerEndpoint={BUNDLER_ENDPOINT}
              />
            )}
          </Card>
        </CardContainer>
      )}
    </Container>
  );
};

export default Playground;
