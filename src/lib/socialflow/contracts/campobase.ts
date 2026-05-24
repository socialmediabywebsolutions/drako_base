import {
  runSocialFlowAutomationContract,
  type SocialFlowAutomationRunInput,
  type SocialFlowAutomationRunOutput,
} from "@/lib/socialflow/contracts/automation";
import {
  getSocialFlowOperatorObservability,
  type SocialFlowOperatorObservability,
} from "@/lib/socialflow/contracts/observability";
import {
  runSocialFlowOperatorAction,
  type SocialFlowOperatorAction,
  type SocialFlowOperatorActionResult,
} from "@/lib/socialflow/contracts/operator-actions";

export type {
  SocialFlowAutomationRunInput,
  SocialFlowAutomationRunOutput,
  SocialFlowOperatorObservability,
  SocialFlowOperatorAction,
  SocialFlowOperatorActionResult,
};

export const runSocialFlowCampobaseAutomationContract = runSocialFlowAutomationContract;
export const getSocialFlowCampobaseOperatorObservabilityContract = getSocialFlowOperatorObservability;
export const runSocialFlowCampobaseOperatorActionContract = runSocialFlowOperatorAction;
