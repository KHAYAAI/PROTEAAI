import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./root";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Subscription {
  plan: "free" | "pro";
  status: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  paymentProvider?: "stripe" | "payfast" | null;
}

interface BillingConfig {
  stripe: boolean;
  payfast: boolean;
}

interface PayfastPaymentData {
  actionUrl: string;
  fields: Record<string, string>;
}

async function fetchSubscription(token: string): Promise<Subscription> {
  const res = await fetch("/billing/subscription", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  return json.data ?? { plan: "free", status: "active" };
}

async function fetchBillingConfig(): Promise<BillingConfig> {
  const res = await fetch("/billing/config");
  const json = await res.json();
  return json.data ?? { stripe: false, payfast: false };
}

async function createStripeCheckout(token: string): Promise<string> {
  const res = await fetch("/billing/create-checkout-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ baseUrl: window.location.origin }),
  });
  const json = await res.json();
  return json.data?.url;
}

async function createStripePortal(token: string): Promise<string> {
  const res = await fetch("/billing/create-portal-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ baseUrl: window.location.origin }),
  });
  const json = await res.json();
  return json.data?.url;
}

async function createPayfastPayment(token: string): Promise<PayfastPaymentData> {
  const res = await fetch("/payfast/create-payment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ baseUrl: window.location.origin }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? "PayFast error");
  return json.data;
}

async function cancelPayfast(token: string): Promise<void> {
  const res = await fetch("/payfast/cancel", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? "Cancel failed");
}

// Submits a hidden HTML form to PayFast's payment page.
// PayFast requires a real form POST (not fetch) to initiate checkout.
function submitPayfastForm(data: PayfastPaymentData) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = data.actionUrl;
  for (const [key, value] of Object.entries(data.fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

function BillingPage() {
  const { token } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [config, setConfig] = useState<BillingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"info" | "error">("info");
  const isMounted = useRef(true);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      setMessage("Subscription activated! Welcome to Pro.");
      setMessageType("info");
    } else if (params.get("canceled") === "true") {
      setMessage("Checkout canceled. No changes were made.");
      setMessageType("info");
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    Promise.all([fetchSubscription(token), fetchBillingConfig()])
      .then(([sub, cfg]) => {
        if (!isMounted.current) return;
        setSubscription(sub);
        setConfig(cfg);
      })
      .finally(() => { if (isMounted.current) setLoading(false); });
  }, [token]);

  const isPro = subscription?.plan === "pro" && subscription?.status === "active";
  const isPayfastPro = isPro && subscription?.paymentProvider === "payfast";
  const isStripePro = isPro && subscription?.paymentProvider === "stripe";

  const handleStripeUpgrade = async () => {
    if (!token) return;
    setActionLoading(true);
    try {
      const url = await createStripeCheckout(token);
      if (url) window.location.href = url;
    } catch {
      setMessage("Failed to start checkout. Please try again.");
      setMessageType("error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStripeManage = async () => {
    if (!token) return;
    setActionLoading(true);
    try {
      const url = await createStripePortal(token);
      if (url) window.location.href = url;
    } catch {
      setMessage("Failed to open billing portal. Please try again.");
      setMessageType("error");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayfastUpgrade = async () => {
    if (!token) return;
    setActionLoading(true);
    try {
      const data = await createPayfastPayment(token);
      submitPayfastForm(data);
      // don't clear loading — page will navigate away
    } catch {
      setMessage("Failed to start PayFast checkout. Please try again.");
      setMessageType("error");
      setActionLoading(false);
    }
  };

  const handlePayfastCancel = async () => {
    if (!token) return;
    if (!confirm("Cancel your Pro subscription? You'll keep access until the end of the billing period.")) return;
    setActionLoading(true);
    try {
      await cancelPayfast(token);
      setSubscription((prev) => prev ? { ...prev, cancelAtPeriodEnd: true } : prev);
      setMessage("Subscription set to cancel at the end of the billing period.");
      setMessageType("info");
    } catch {
      setMessage("Failed to cancel subscription. Please contact support.");
      setMessageType("error");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-12">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="mt-1 text-muted-foreground">Manage your ProteaAI subscription</p>
      </div>

      {message && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          messageType === "error"
            ? "border-destructive/50 bg-destructive/10 text-destructive"
            : "border-border bg-muted"
        }`}>
          {message}
        </div>
      )}

      {/* Current plan card */}
      <div className="rounded-lg border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Current plan</p>
            <p className="text-xl font-semibold capitalize">
              {loading ? "—" : (subscription?.plan ?? "Free")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isPro && subscription?.paymentProvider && (
              <span className="text-xs text-muted-foreground">
                via {subscription.paymentProvider === "payfast" ? "PayFast" : "Stripe"}
              </span>
            )}
            <Badge variant={isPro ? "default" : "secondary"}>
              {loading ? "…" : isPro ? "Active" : "Free"}
            </Badge>
          </div>
        </div>

        {subscription?.currentPeriodEnd && (
          <p className="text-sm text-muted-foreground">
            {subscription.cancelAtPeriodEnd
              ? `Cancels on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
              : `Renews on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
          </p>
        )}

        {/* Action buttons */}
        {!isPro && (
          <div className="flex flex-col gap-2 sm:flex-row">
            {config?.stripe && (
              <Button onClick={handleStripeUpgrade} disabled={actionLoading || loading}>
                {actionLoading ? "Redirecting…" : "Upgrade with card"}
              </Button>
            )}
            {config?.payfast && (
              <Button
                onClick={handlePayfastUpgrade}
                disabled={actionLoading || loading}
                variant={config?.stripe ? "outline" : "default"}
              >
                {actionLoading ? "Redirecting…" : "Upgrade with PayFast (ZAR)"}
              </Button>
            )}
          </div>
        )}

        {isStripePro && !subscription?.cancelAtPeriodEnd && (
          <Button variant="outline" onClick={handleStripeManage} disabled={actionLoading}>
            {actionLoading ? "Redirecting…" : "Manage subscription"}
          </Button>
        )}

        {isPayfastPro && !subscription?.cancelAtPeriodEnd && (
          <Button variant="outline" onClick={handlePayfastCancel} disabled={actionLoading}>
            {actionLoading ? "Canceling…" : "Cancel subscription"}
          </Button>
        )}
      </div>

      {/* Plan comparison */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border p-5 space-y-3">
          <p className="font-semibold">Free</p>
          <p className="text-2xl font-bold">
            $0<span className="text-sm font-normal text-muted-foreground">/mo</span>
          </p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>✓ Unlimited build mode</li>
            <li>✓ 5 agent messages / day</li>
            <li>✓ GitHub, Supabase integration</li>
            <li>✗ Turbo edits</li>
            <li>✗ Smart context</li>
            <li>✗ Web search</li>
          </ul>
        </div>

        <div className="rounded-lg border-2 border-primary p-5 space-y-3">
          <p className="font-semibold">Pro</p>
          <div className="space-y-0.5">
            {config?.stripe && (
              <p className="text-2xl font-bold">
                $20<span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
            )}
            {config?.payfast && (
              <p className={config?.stripe ? "text-sm text-muted-foreground" : "text-2xl font-bold"}>
                {config?.stripe ? "or " : ""}
                R149<span className="text-sm font-normal text-muted-foreground">/mo via PayFast</span>
              </p>
            )}
          </div>
          <ul className="space-y-1 text-sm">
            <li>✓ Everything in Free</li>
            <li>✓ Unlimited agent messages</li>
            <li>✓ Turbo edits</li>
            <li>✓ Smart context</li>
            <li>✓ Web search</li>
            <li>✓ Priority support</li>
          </ul>
        </div>
      </div>

      {config?.payfast && (
        <p className="text-xs text-muted-foreground text-center">
          PayFast payments are processed in South African Rand (ZAR). Recurring monthly billing via PayFast subscriptions.
        </p>
      )}
    </div>
  );
}

export const billingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/billing",
  component: () => (
    <AuthGuard>
      <BillingPage />
    </AuthGuard>
  ),
});
