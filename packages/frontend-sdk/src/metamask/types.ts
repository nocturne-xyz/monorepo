export type GetSnapsResponse = Record<string, Snap>;

export interface Snap {
  permissionName: string;
  id: string;
  version: string;
  initialPermissions: Record<string, unknown>;
};

export interface MetamaskState {
  isFlask: boolean;
  installedSnap: Snap | undefined;
  walletConnected: boolean;
  error?: Error;
};

export interface GetSnapOptions {
  // if not provided, the latest version is used
  version?: string;

  // see documentation / ask the team for this
  snapId?: string; 
};
