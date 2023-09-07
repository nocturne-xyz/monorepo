import { DelaySeconds } from "./RuleSet";

export interface DelayModifier {
  modifier: DelayModifierFn;
  effect: DelayModifierEffect;
  reason: string;
}

export type DelayModifierFn = (delay: DelaySeconds) => DelaySeconds;
export type DelayModifierEffect = `add ${number} seconds` | `multiply by ${number}` | `nothing`;

export function DelayIdentity(reason: string): DelayModifier {
  return {
    modifier: (delay) => delay,
    effect: `nothing`,
    reason,
  };
};

export function DelayAdd(seconds: DelaySeconds, reason: string): DelayModifier {
  return {
    modifier: (delay) => delay + seconds,
    effect: `add ${seconds} seconds`,
    reason,
  };
}

export function DelayMultiply(factor: number, reason: string): DelayModifier {
  return {
    modifier: (delay) => delay * factor,
    effect: `multiply by ${factor}`,
    reason,
  };
}