/**
 * What scripts/demo-video.mjs installs in the tab before the app loads.
 *
 * Kept apart so it can be pulled into a one-off probe without starting a
 * recording. Serialised with Function.prototype.toString, so it must not close
 * over anything.
 */

/**
 * Everything the tab needs: a Wallet Standard wallet over an imported keypair, a
 * cursor that shows up on video, and a caption bar.
 */
export function pageInit({ seed, pub, walletName, captions }) {
  const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const base58 = (bytes) => {
    const digits = [0];
    for (const byte of bytes) {
      let carry = byte;
      for (let i = 0; i < digits.length; i++) {
        carry += digits[i] << 8;
        digits[i] = carry % 58;
        carry = (carry / 58) | 0;
      }
      while (carry > 0) {
        digits.push(carry % 58);
        carry = (carry / 58) | 0;
      }
    }
    let out = "";
    for (const byte of bytes) {
      if (byte === 0) out += "1";
      else break;
    }
    for (let i = digits.length - 1; i >= 0; i--) out += B58[digits[i]];
    return out;
  };

  /** Read a shortvec length prefix. Returns [value, bytesRead]. */
  const shortvec = (bytes, offset) => {
    let value = 0;
    let size = 0;
    for (;;) {
      const byte = bytes[offset + size];
      value |= (byte & 0x7f) << (size * 7);
      size += 1;
      if ((byte & 0x80) === 0) break;
    }
    return [value, size];
  };

  const publicKey = Uint8Array.from(pub);
  const address = base58(publicKey);

  // PKCS#8 wrapper for a raw Ed25519 seed, which is the only form WebCrypto
  // will import.
  const PKCS8 = [
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70,
    0x04, 0x22, 0x04, 0x20,
  ];
  const ready = crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from([...PKCS8, ...seed]),
    "Ed25519",
    false,
    ["sign"],
  );

  async function signTransaction({ transaction }) {
    const priv = await ready;
    const bytes = new Uint8Array(transaction);
    const [signatureCount, prefix] = shortvec(bytes, 0);
    const message = bytes.subarray(prefix + signatureCount * 64);

    // Legacy message header, then the account keys. Our slot in the signature
    // array is our position among the required signers.
    const requiredSigners = message[0];
    const [keyCount, keyPrefix] = shortvec(message, 3);
    let slot = -1;
    for (let i = 0; i < Math.min(requiredSigners, keyCount); i++) {
      const at = 3 + keyPrefix + i * 32;
      let same = true;
      for (let j = 0; j < 32; j++) {
        if (message[at + j] !== publicKey[j]) {
          same = false;
          break;
        }
      }
      if (same) {
        slot = i;
        break;
      }
    }
    if (slot === -1) throw new Error("the demo wallet is not a signer here");

    const signature = new Uint8Array(
      await crypto.subtle.sign("Ed25519", priv, message),
    );
    // Keep every signature already on the transaction: extra signers sign
    // before the wallet does.
    const signed = new Uint8Array(bytes);
    signed.set(signature, prefix + slot * 64);
    return [{ signedTransaction: signed }];
  }

  const account = {
    address,
    publicKey,
    chains: ["solana:devnet", "solana:testnet", "solana:mainnet", "solana:localnet"],
    features: ["solana:signTransaction"],
    label: walletName,
    icon: undefined,
  };

  const listeners = {};
  const wallet = {
    version: "1.0.0",
    name: walletName,
    icon:
      "data:image/svg+xml;base64," +
      btoa(
        '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#c8a44a"/></svg>',
      ),
    chains: account.chains,
    accounts: [account],
    features: {
      "standard:connect": {
        version: "1.0.0",
        connect: async () => ({ accounts: [account] }),
      },
      "standard:disconnect": { version: "1.0.0", disconnect: async () => {} },
      "standard:events": {
        version: "1.0.0",
        on: (event, listener) => {
          (listeners[event] ||= []).push(listener);
          return () => {
            listeners[event] = (listeners[event] || []).filter((l) => l !== listener);
          };
        },
      },
      "solana:signTransaction": {
        version: "1.0.0",
        supportedTransactionVersions: ["legacy", 0],
        signTransaction: async (...inputs) => {
          const out = [];
          for (const input of inputs) out.push(...(await signTransaction(input)));
          return out;
        },
      },
    },
  };

  const announce = ({ register }) => register(wallet);
  window.addEventListener("wallet-standard:app-ready", (event) =>
    announce(event.detail),
  );
  window.dispatchEvent(
    new CustomEvent("wallet-standard:register-wallet", { detail: announce }),
  );

  /* ------------------------------------------------------------- overlays */

  let cursor = null;
  let bar = null;

  function mount() {
    if (!document.body || document.getElementById("__demo_cursor")) return;

    cursor = document.createElement("div");
    cursor.id = "__demo_cursor";
    cursor.style.cssText = [
      "position:fixed",
      "left:0",
      "top:0",
      "width:22px",
      "height:22px",
      "margin:-11px 0 0 -11px",
      "border:2px solid #c8a44a",
      "border-radius:50%",
      "background:rgba(200,164,74,0.22)",
      "box-shadow:0 0 0 1px rgba(0,0,0,0.5)",
      "pointer-events:none",
      "z-index:2147483647",
      "transform:translate(-100px,-100px)",
      "transition:width 90ms ease-out,height 90ms ease-out",
    ].join(";");
    document.body.appendChild(cursor);

    if (captions) {
      bar = document.createElement("div");
      bar.id = "__demo_caption";
      bar.style.cssText = [
        "position:fixed",
        "left:0",
        "right:0",
        "bottom:0",
        "padding:18px 48px 22px",
        "background:linear-gradient(to top,rgba(8,8,9,0.96),rgba(8,8,9,0.82) 70%,rgba(8,8,9,0))",
        "border-top:1px solid rgba(200,164,74,0.35)",
        "font:400 21px/1.45 ui-serif,Georgia,serif",
        "color:#ede6d6",
        "pointer-events:none",
        "z-index:2147483646",
        "opacity:0",
        "transition:opacity 260ms ease-out",
      ].join(";");
      bar.innerHTML =
        '<div id="__demo_label" style="font:500 12px/1 ui-sans-serif,system-ui;letter-spacing:.14em;text-transform:uppercase;color:#c8a44a;margin-bottom:8px"></div>' +
        '<div id="__demo_text" style="max-width:110ch"></div>';
      document.body.appendChild(bar);
    }

    window.addEventListener(
      "mousemove",
      (event) => {
        if (cursor)
          cursor.style.transform = `translate(${event.clientX}px,${event.clientY}px)`;
      },
      true,
    );
    window.addEventListener(
      "mousedown",
      () => {
        if (!cursor) return;
        cursor.style.background = "rgba(200,164,74,0.55)";
        setTimeout(() => {
          if (cursor) cursor.style.background = "rgba(200,164,74,0.22)";
        }, 180);
      },
      true,
    );
  }

  window.__demo = {
    address,
    mount,
    caption(label, text) {
      mount();
      const el = document.getElementById("__demo_caption");
      if (!el) return;
      document.getElementById("__demo_label").textContent = label ?? "";
      document.getElementById("__demo_text").textContent = text ?? "";
      el.style.opacity = text ? "1" : "0";
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
}
