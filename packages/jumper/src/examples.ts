import autopay from "../examples/autopay.jumper" with { type: "text" };
import broken from "../examples/broken.jumper" with { type: "text" };
import passwordReset from "../examples/password-reset.jumper" with { type: "text" };
import volunteerRequests from "../examples/volunteer-requests.jumper" with { type: "text" };

export type Example = { id: string; name: string; source: string };

export const examples: readonly Example[] = [
  { id: "autopay", name: "Invoice autopay", source: autopay },
  { id: "password-reset", name: "Password reset", source: passwordReset },
  { id: "volunteer-requests", name: "Volunteer requests", source: volunteerRequests },
  { id: "broken", name: "Broken checkout (gaps)", source: broken },
];
