export type ErrString = string;

export interface ActorHandle {
  // promise that resolves when the service is done
  promise: Promise<void>;
  // function to teardown the service
  teardown: () => Promise<void>;
}

export interface HealthCheckResponse {
  uptime: number;
  message: string;
  timestamp: number;
}
