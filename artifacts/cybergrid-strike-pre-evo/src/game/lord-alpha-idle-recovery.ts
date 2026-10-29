export const LORD_ALPHA_IDLE_RECOVERY_INTERVAL_SECONDS = 1;
export const LORD_ALPHA_IDLE_RECOVERY_HP_CAP = 5;

export interface LordAlphaIdleRecoveryState {
  elapsedIdleSeconds: number;
  observedHp: number;
}

export interface LordAlphaIdleRecoveryResult {
  state: LordAlphaIdleRecoveryState;
  hp: number;
  recovered: number;
}

export const createLordAlphaIdleRecoveryState = (
  hp: number,
): LordAlphaIdleRecoveryState => ({
  elapsedIdleSeconds: 0,
  observedHp: hp,
});

/**
 * Advances LASI's idle recovery without owning any rendering or input state.
 * Any activity or external HP change breaks the current uninterrupted idle
 * interval. Recovery itself updates observedHp so consecutive one-second ticks
 * can continue until the five-HP cap is reached.
 */
export const advanceLordAlphaIdleRecovery = (
  state: LordAlphaIdleRecoveryState,
  input: {
    deltaSeconds: number;
    hp: number;
    idle: boolean;
    enabled: boolean;
  },
): LordAlphaIdleRecoveryResult => {
  const hp = Number.isFinite(input.hp) ? input.hp : state.observedHp;
  const interrupted = !input.enabled
    || !input.idle
    || hp !== state.observedHp
    || hp >= LORD_ALPHA_IDLE_RECOVERY_HP_CAP;

  if (interrupted) {
    return {
      state: createLordAlphaIdleRecoveryState(hp),
      hp,
      recovered: 0,
    };
  }

  const deltaSeconds = Number.isFinite(input.deltaSeconds)
    ? Math.max(0, input.deltaSeconds)
    : 0;
  const accumulated = state.elapsedIdleSeconds + deltaSeconds;
  const availableTicks = Math.floor(
    (accumulated + Number.EPSILON) / LORD_ALPHA_IDLE_RECOVERY_INTERVAL_SECONDS,
  );
  const recovered = Math.min(
    availableTicks,
    Math.max(0, LORD_ALPHA_IDLE_RECOVERY_HP_CAP - hp),
  );
  const nextHp = hp + recovered;

  return {
    state: {
      elapsedIdleSeconds: nextHp >= LORD_ALPHA_IDLE_RECOVERY_HP_CAP
        ? 0
        : accumulated - recovered * LORD_ALPHA_IDLE_RECOVERY_INTERVAL_SECONDS,
      observedHp: nextHp,
    },
    hp: nextHp,
    recovered,
  };
};
