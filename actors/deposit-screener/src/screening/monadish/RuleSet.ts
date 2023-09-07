import { Thunk, thunk } from "@nocturne-xyz/core";
import { ScreeningDepositRequest } from "..";
import { dummyMistTrackAddressRiskScore, DummyMistTrackData, mistTrackAddressOverview, MistTrackAddressOverviewData, mistTrackAddressRiskScore, MistTrackRiskScoreData } from "./mistTrack";
import { DummyTrmData, TrmData, dummyTrmScreeningAdresses, trmScreeningAddresses } from "./trm";
import { DelayModifierEffect, DelayModifier } from "./modifier";

const TWO_HOURS_SECONDS = 60 * 60 * 2;

export type DelaySeconds = number;

export interface ThunkedAPICalls {
  trmScreeningAddresses: Thunk<TrmData>;
  mistTrackAddressOverview: Thunk<MistTrackAddressOverviewData>;
  mistTrackAddressRiskScore: Thunk<MistTrackRiskScoreData>;
  dummyTrmScreeningAdresses: Thunk<DummyTrmData>;
  dummyMistTrackAddressRiskScore: Thunk<DummyMistTrackData>;
}

export function getThunkedAPICalls(deposit: ScreeningDepositRequest): ThunkedAPICalls {
  return {
    trmScreeningAddresses: thunk(async () => await trmScreeningAddresses(deposit)),
    dummyTrmScreeningAdresses: thunk(async () => await dummyTrmScreeningAdresses(deposit)),
    mistTrackAddressOverview: thunk(async () => await mistTrackAddressOverview(deposit)),
    mistTrackAddressRiskScore: thunk(async () => await mistTrackAddressRiskScore(deposit)),
    dummyMistTrackAddressRiskScore: thunk(async () => await dummyMistTrackAddressRiskScore(deposit)),
  };
}

export type DelayModifierMetadata = Pick<DelayModifier, "effect" | "reason">;

export interface DelayWithMedata {
  delay: DelaySeconds;
  modifierMetas: DelayModifierMetadata[];
}

// if rule results in a deposit rejection, this function must throw an instance of `RuleSetRejection`
export type RuleCheckFn = (deposit: ScreeningDepositRequest, api: ThunkedAPICalls) => Promise<DelayModifier>;

export interface Rule {
  name: string,
  check: RuleCheckFn,
}

export class RuleSet {
  protected _apply: (deposit: ScreeningDepositRequest, initialDelay: DelaySeconds, api: ThunkedAPICalls) => Promise<DelayWithMedata>;

  constructor(rules?: Rule[]) {
    //@eslint-disable-next-line @typescript-eslint/no-unused-vars
    this._apply = async (deposit: ScreeningDepositRequest, initialDelay: DelaySeconds, api: ThunkedAPICalls) => {
      return {
        delay: initialDelay,
        modifierMetas: [],
      };
    };

    if (rules) {
      rules.forEach((rule) => this.add(rule));
    }
  }

  add(rule: Rule): RuleSet {
    const inner = this._apply;
    this._apply = async (deposit: ScreeningDepositRequest, initialDelay: DelaySeconds, api: ThunkedAPICalls) => {
      const { delay, modifierMetas } = await inner(deposit, initialDelay, api);
      const { modifier, effect, reason } = await rule.check(deposit, api);
      return {
        delay: modifier(delay),
        modifierMetas: [...modifierMetas, { effect, reason }],
      };
    };

    return this;
  }

  // if rules are rejected, returns an Error of type `RuleSetRejection
  async apply(deposit: ScreeningDepositRequest, initialDelay: DelaySeconds = TWO_HOURS_SECONDS): Promise<DelayWithMedata | RuleSetRejection> {
    const api = getThunkedAPICalls(deposit);
    try {
      return await this._apply(deposit, initialDelay, api);
    } catch (err) {
      if (err instanceof RuleSetRejection) {
        return err;
      } else {
        throw new Error(`A rule rejected with an unexpected error: ${err}`);
      }
    }
  }
}

export class RuleSetRejection extends Error {
  constructor(reason: string) {
    super(reason);

    Object.setPrototypeOf(this, RuleSetRejection.prototype);
  }
}
