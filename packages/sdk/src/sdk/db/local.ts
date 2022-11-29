import {
  DEFAULT_SERIALIZABLE_STATE,
  ObjectDB,
  SerializableState,
} from "./objectdb";

interface LocalObjectDBOptions {
  localMerkle: boolean;
}

export class LocalObjectDB extends ObjectDB {
  state: SerializableState;

  constructor(options: LocalObjectDBOptions) {
    super();
    this.state = DEFAULT_SERIALIZABLE_STATE;

    if (options.localMerkle) {
      this.state.leaves = undefined;
    }
  }

  async storeSerializableState(state: SerializableState): Promise<boolean> {
    this.state = state;
    return true;
  }

  async getSerializableState(): Promise<SerializableState> {
    return this.state;
  }
}
