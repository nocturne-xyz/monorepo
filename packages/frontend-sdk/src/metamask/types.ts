export type GetSnapsResponse = Record<string, Snap>;

export type Snap = {
  permissionName: string;
  id: string;
  version: string;
  initialPermissions: Record<string, unknown>;
};

export type MetamaskState = {
  isFlask: boolean;
  installedSnap: Snap | undefined;
  walletConnected: boolean;
  error?: Error;
};

export type GetSnapOptions = Partial<{
  version: string; // if not provided, the latest version is used
  snapId: string; // for most consumers, the default NOCTURNE_SNAP_ORIGIN is correct
}>;
