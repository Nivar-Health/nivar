"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Signalling } from "@/lib/socket";
import { Mic, MicOff, PhoneOff, RotateCcw, Users, Video, VideoOff, Volume2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type VideoCallProps = {
  /** Realtime signalling adapter for the signed-in user (see `useSignalling`). */
  signalling: Signalling;
  bookingId: string;
  self: { name: string; role: string };
  /** Called after the user leaves. If omitted, a "Rejoin" screen is shown instead. */
  onLeave?: () => void;
  /** Narrow side-panel layout (stacked tiles, smaller controls). */
  compact?: boolean;
  className?: string;
};

type PeerInfo = { peerId: string; name?: string; role?: string };

type RtcJoin = PeerInfo & { bookingId?: string };
type RtcPeerHere = PeerInfo & { bookingId?: string; to: string };
type RtcSignal = { bookingId?: string; to: string; from: string; data: SignalData };
type RtcLeave = { bookingId?: string; peerId: string };

type PeerView = {
  id: string;
  name: string;
  role: string;
  stream: MediaStream | null;
  tracks: number;
  state: RTCPeerConnectionState;
  audio: boolean;
  video: boolean;
};

type SignalData =
  | { description: RTCSessionDescriptionInit }
  | { candidate: RTCIceCandidateInit }
  | { media: { audio: boolean; video: boolean; name?: string; role?: string } };

type PeerConn = {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  awaitingOffer: boolean;
  pending: RTCIceCandidateInit[];
  remote: MediaStream;
  queue: Promise<void>;
};

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

const ROLE_LABEL: Record<string, string> = {
  customer: "Patient",
  patient: "Patient",
  nurse: "Nurse",
  doctor: "Doctor",
  admin: "Admin",
};

const ROLE_STYLE: Record<string, string> = {
  doctor: "bg-white text-ink",
  nurse: "bg-white/15 text-white ring-1 ring-white/30",
  customer: "bg-white/15 text-white",
  patient: "bg-white/15 text-white",
};

function roleLabel(role: string) {
  return ROLE_LABEL[role] ?? (role ? role[0].toUpperCase() + role.slice(1) : "Guest");
}

function initialsOf(name: string) {
  const parts = name
    .replace(/\(.*?\)/g, "")
    .trim()
    .split(/\s+/)
    .filter((p) => p && !/^(dr|mr|mrs|ms|sr)\.?$/i.test(p));
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function describeMediaError(err: unknown): string {
  const name = (err as { name?: string })?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Camera and microphone permission was blocked.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera or microphone was found.";
  if (name === "NotReadableError" || name === "AbortError") return "Your camera is busy in another app or tab.";
  if (name === "InsecureContext") return "Camera access needs a secure (https) connection.";
  return "Could not start your camera.";
}

async function acquireMedia(): Promise<{ stream: MediaStream | null; error: string | null }> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return { stream: null, error: describeMediaError({ name: "InsecureContext" }) };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24 }, facingMode: "user" },
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    return { stream, error: null };
  } catch (err) {
    const name = (err as { name?: string })?.name;
    if (name === "NotAllowedError" || name === "SecurityError") return { stream: null, error: describeMediaError(err) };
    // Camera missing or busy: try audio only so the user can still talk.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return { stream, error: `${describeMediaError(err)} Joined with audio only.` };
    } catch {
      return { stream: null, error: describeMediaError(err) };
    }
  }
}

/* ------------------------------------------------------------------------- */
/* Tile                                                                      */
/* ------------------------------------------------------------------------- */

function VideoTile({
  stream,
  tracks,
  name,
  label,
  role,
  videoOn,
  audioOn,
  muted,
  mirrored,
  connecting,
  small,
  className,
}: {
  stream: MediaStream | null;
  tracks: number;
  name: string;
  /** Display label; defaults to name. Avatar initials always come from name. */
  label?: string;
  role: string;
  videoOn: boolean;
  audioOn: boolean;
  muted?: boolean;
  mirrored?: boolean;
  connecting?: boolean;
  small?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (v.srcObject !== stream) v.srcObject = stream;
    if (stream) {
      v.play().then(
        () => setBlocked(false),
        (e: unknown) => {
          if ((e as { name?: string })?.name === "NotAllowedError") setBlocked(true);
        },
      );
    }
  }, [stream, tracks]);

  const hasVideo = !!stream && stream.getVideoTracks().length > 0 && videoOn;

  return (
    <div className={cn("relative overflow-hidden bg-[#1a1a1a]", small ? "rounded-xl" : "rounded-2xl", className)}>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={cn(
          "absolute inset-0 size-full object-cover transition-opacity duration-300",
          mirrored && "-scale-x-100",
          hasVideo ? "opacity-100" : "opacity-0",
        )}
      />
      {!hasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#161616]">
          <div
            className={cn(
              "flex items-center justify-center rounded-full bg-white/10 font-semibold text-white ring-4 ring-white/5",
              small ? "size-10 text-sm" : "size-16 text-xl sm:size-20 sm:text-2xl",
            )}
          >
            {initialsOf(name)}
          </div>
          {!small && (
            <span className="text-xs text-white/50">
              {connecting ? "Connecting..." : stream ? "Camera off" : "No video"}
            </span>
          )}
        </div>
      )}

      <div className={cn("absolute flex max-w-[calc(100%-1rem)] items-center gap-1.5", small ? "bottom-1.5 left-1.5" : "bottom-2.5 left-2.5")}>
        <span
          className={cn(
            "flex min-w-0 items-center gap-1.5 rounded-full bg-black/55 font-medium text-white backdrop-blur-md",
            small ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
          )}
        >
          {!audioOn && <MicOff className={cn("shrink-0 text-[#FF8A7F]", small ? "size-3" : "size-3.5")} />}
          <span className="truncate">{label ?? name}</span>
          {!small && (
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold",
                ROLE_STYLE[role] ?? "bg-white/15 text-white",
              )}
            >
              {roleLabel(role)}
            </span>
          )}
        </span>
      </div>

      {blocked && (
        <button
          type="button"
          onClick={() => {
            ref.current?.play().then(() => setBlocked(false), () => {});
          }}
          className="absolute inset-x-0 top-3 mx-auto flex w-fit items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-lg"
        >
          <Volume2 className="size-3.5" /> Tap to enable audio
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Call                                                                      */
/* ------------------------------------------------------------------------- */

export function VideoCall(props: VideoCallProps) {
  const [session, setSession] = useState(0);
  const [left, setLeft] = useState(false);
  const { onLeave } = props;

  const leave = useCallback(() => {
    setLeft(true);
    onLeave?.();
  }, [onLeave]);

  if (left) {
    if (props.onLeave) return null;
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-2xl bg-[#0f0f0f] p-8 text-center text-white",
          props.compact ? "min-h-[280px]" : "min-h-[420px]",
          props.className,
        )}
      >
        <p className="text-sm text-white/70">You left the consultation.</p>
        <button
          type="button"
          onClick={() => {
            setSession((s) => s + 1);
            setLeft(false);
          }}
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-white/90"
        >
          <RotateCcw className="size-4" /> Rejoin
        </button>
      </div>
    );
  }
  return <CallSession key={session} {...props} onLeave={leave} />;
}

function CallSession({ signalling, bookingId, self, onLeave, compact, className }: VideoCallProps & { onLeave: () => void }) {
  const [peers, setPeers] = useState<PeerView[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [online, setOnline] = useState(true);

  const localRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, PeerConn>>(new Map());
  const mediaStateRef = useRef({ audio: true, video: true });
  const selfRef = useRef(self);
  useEffect(() => {
    selfRef.current = self;
  }, [self]);

  const sendMediaState = useCallback(
    (to?: string) => {
      const data: SignalData = {
        media: { ...mediaStateRef.current, name: selfRef.current.name, role: selfRef.current.role },
      };
      const targets = to ? [to] : [...pcsRef.current.keys()];
      targets.forEach((id) =>
        signalling.send("rtc:signal", { bookingId, to: id, from: signalling.peerId, data }),
      );
    },
    [signalling, bookingId],
  );

  useEffect(() => {
    let disposed = false;
    let revision = 0;
    const pcs = pcsRef.current;

    const patchPeer = (id: string, patch: Partial<PeerView>) =>
      setPeers((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

    const upsertPeer = (info: PeerInfo) =>
      setPeers((prev) => {
        const existing = prev.find((p) => p.id === info.peerId);
        if (existing) {
          return prev.map((p) =>
            p.id === info.peerId ? { ...p, name: info.name ?? p.name, role: info.role ?? p.role } : p,
          );
        }
        return [
          ...prev,
          {
            id: info.peerId,
            name: info.name ?? "Guest",
            role: info.role ?? "",
            stream: null,
            tracks: 0,
            state: "new",
            audio: true,
            video: true,
          },
        ];
      });

    const me = signalling.peerId;
    const send = (to: string, data: SignalData) =>
      signalling.send("rtc:signal", { bookingId, to, from: me, data });
    const forThisCall = (p: { bookingId?: string } | null | undefined) => !!p && (!p.bookingId || p.bookingId === bookingId);

    const closePeer = (id: string) => {
      const entry = pcs.get(id);
      if (entry) {
        entry.pc.onicecandidate = null;
        entry.pc.ontrack = null;
        entry.pc.onnegotiationneeded = null;
        entry.pc.onconnectionstatechange = null;
        entry.pc.oniceconnectionstatechange = null;
        entry.pc.close();
        pcs.delete(id);
      }
      setPeers((prev) => prev.filter((p) => p.id !== id));
    };

    const closeAll = () => {
      [...pcs.keys()].forEach(closePeer);
    };

    const createPeer = (info: PeerInfo, initiator: boolean): PeerConn => {
      const existing = pcs.get(info.peerId);
      if (existing) {
        upsertPeer(info);
        return existing;
      }
      const id = info.peerId;
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const entry: PeerConn = {
        pc,
        // Deterministic roles for glare resolution (perfect negotiation).
        polite: me > id,
        makingOffer: false,
        ignoreOffer: false,
        // Existing members wait for the newcomer's offer ("new joiner offers").
        awaitingOffer: !initiator,
        pending: [],
        remote: new MediaStream(),
        queue: Promise.resolve(),
      };
      pcs.set(id, entry);
      upsertPeer(info);

      const local = localRef.current;
      const kinds = new Set(local?.getTracks().map((t) => t.kind) ?? []);
      local?.getTracks().forEach((t) => pc.addTrack(t, local));
      // Always be able to receive, even without a camera/mic of our own.
      if (!kinds.has("audio")) pc.addTransceiver("audio", { direction: "recvonly" });
      if (!kinds.has("video")) pc.addTransceiver("video", { direction: "recvonly" });

      pc.onnegotiationneeded = async () => {
        if (entry.awaitingOffer) return;
        try {
          entry.makingOffer = true;
          await pc.setLocalDescription();
          if (pc.localDescription) send(id, { description: pc.localDescription.toJSON() });
        } catch (err) {
          console.warn("[video-call] negotiation failed", err);
        } finally {
          entry.makingOffer = false;
        }
      };
      pc.onicecandidate = ({ candidate }) => {
        if (candidate) send(id, { candidate: candidate.toJSON() });
      };
      pc.ontrack = ({ track }) => {
        if (!entry.remote.getTracks().includes(track)) entry.remote.addTrack(track);
        // Bump a revision so the tile re-attaches and re-plays when media starts flowing.
        track.onunmute = () => patchPeer(id, { tracks: ++revision });
        patchPeer(id, { stream: entry.remote, tracks: ++revision });
      };
      pc.onconnectionstatechange = () => {
        patchPeer(id, { state: pc.connectionState });
        if (pc.connectionState === "connected") sendMediaState(id);
        if (pc.connectionState === "failed") pc.restartIce?.();
      };
      return entry;
    };

    const handleSignal = async (from: string, data: SignalData) => {
      const entry = pcs.get(from) ?? createPeer({ peerId: from }, false);
      const { pc } = entry;
      if ("description" in data && data.description) {
        const desc = data.description;
        const collision = desc.type === "offer" && (entry.makingOffer || pc.signalingState !== "stable");
        entry.ignoreOffer = !entry.polite && collision;
        if (entry.ignoreOffer) return;
        await pc.setRemoteDescription(desc);
        for (const c of entry.pending.splice(0)) await pc.addIceCandidate(c).catch(() => {});
        if (desc.type === "offer") {
          entry.awaitingOffer = false;
          await pc.setLocalDescription();
          if (pc.localDescription) send(from, { description: pc.localDescription.toJSON() });
        }
      } else if ("candidate" in data && data.candidate) {
        if (!pc.remoteDescription) {
          entry.pending.push(data.candidate);
          return;
        }
        try {
          await pc.addIceCandidate(data.candidate);
        } catch (err) {
          if (!entry.ignoreOffer) console.warn("[video-call] addIceCandidate failed", err);
        }
      } else if ("media" in data && data.media) {
        const m = data.media;
        patchPeer(from, {
          audio: m.audio,
          video: m.video,
          ...(m.name ? { name: m.name } : {}),
          ...(m.role ? { role: m.role } : {}),
        });
      }
    };

    // Protocol: the joiner broadcasts rtc:join, every peer already in the call replies with
    // rtc:peer-here addressed to it, and the joiner then offers to each of them.
    const onJoin = (payload: unknown) => {
      const info = payload as RtcJoin;
      if (!forThisCall(info) || !info.peerId || info.peerId === me) return;
      // A peer we already know re-announcing itself has reconnected: start that link over.
      if (pcs.has(info.peerId)) closePeer(info.peerId);
      createPeer(info, false);
      signalling.send("rtc:peer-here", {
        bookingId,
        to: info.peerId,
        peerId: me,
        name: selfRef.current.name,
        role: selfRef.current.role,
      });
    };
    const onPeerHere = (payload: unknown) => {
      const info = payload as RtcPeerHere;
      if (!forThisCall(info) || info.to !== me || !info.peerId || info.peerId === me) return;
      createPeer(info, true);
    };
    const onPeerLeft = (payload: unknown) => {
      const info = payload as RtcLeave;
      if (forThisCall(info) && info.peerId) closePeer(info.peerId);
    };
    const onSignal = (payload: unknown) => {
      const msg = payload as RtcSignal;
      if (!forThisCall(msg) || msg.to !== me || !msg.from || !msg.data) return;
      const entry = pcs.get(msg.from);
      const run = () => handleSignal(msg.from, msg.data).catch((err) => console.warn("[video-call] signal error", err));
      if (entry) entry.queue = entry.queue.then(run);
      else void run();
    };
    const join = () =>
      signalling.send("rtc:join", { bookingId, peerId: me, name: selfRef.current.name, role: selfRef.current.role });
    let joined = false;
    let wasOnline = true;
    const onConnection = (connected: boolean) => {
      if (!joined) return;
      setOnline(connected);
      if (connected && !wasOnline) {
        // Channel came back: rebuild the mesh from scratch, as after a socket reconnect.
        closeAll();
        join();
      }
      wasOnline = connected;
    };
    const unsubs: Array<() => void> = [];

    (async () => {
      const { stream, error } = await acquireMedia();
      if (disposed) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }
      localRef.current = stream;
      mediaStateRef.current = {
        audio: !!stream?.getAudioTracks().length,
        video: !!stream?.getVideoTracks().length,
      };
      setLocalStream(stream);
      setMicOn(mediaStateRef.current.audio);
      setCamOn(mediaStateRef.current.video);
      setMediaError(error);
      setMediaReady(true);

      unsubs.push(
        signalling.on("rtc:join", onJoin),
        signalling.on("rtc:peer-here", onPeerHere),
        signalling.on("rtc:leave", onPeerLeft),
        signalling.on("rtc:signal", onSignal),
        signalling.onConnectionChange(onConnection),
      );
      await signalling.join(bookingId);
      if (disposed) return;
      joined = true;
      join();
    })();

    return () => {
      disposed = true;
      unsubs.forEach((off) => off());
      signalling.send("rtc:leave", { bookingId, peerId: me });
      signalling.leave(bookingId);
      closeAll();
      localRef.current?.getTracks().forEach((t) => t.stop());
      localRef.current = null;
    };
  }, [signalling, bookingId, sendMediaState]);

  const toggleMic = () => {
    const tracks = localRef.current?.getAudioTracks() ?? [];
    if (!tracks.length) return;
    const next = !micOn;
    tracks.forEach((t) => (t.enabled = next));
    mediaStateRef.current.audio = next;
    setMicOn(next);
    sendMediaState();
  };
  const toggleCam = () => {
    const tracks = localRef.current?.getVideoTracks() ?? [];
    if (!tracks.length) return;
    const next = !camOn;
    tracks.forEach((t) => (t.enabled = next));
    mediaStateRef.current.video = next;
    setCamOn(next);
    sendMediaState();
  };

  const hasMic = !!localStream?.getAudioTracks().length;
  const hasCam = !!localStream?.getVideoTracks().length;
  const connected = peers.filter((p) => p.state === "connected").length;
  const connecting = peers.some((p) => p.state === "new" || p.state === "connecting");
  const troubled = peers.some((p) => p.state === "disconnected" || p.state === "failed");

  const status = !online
    ? { label: "Reconnecting", dot: "bg-saffron", pulse: true }
    : !mediaReady
      ? { label: "Starting camera", dot: "bg-saffron", pulse: true }
      : peers.length === 0
        ? { label: "Waiting for others", dot: "bg-white/60", pulse: true }
        : troubled
          ? { label: "Weak connection", dot: "bg-saffron", pulse: true }
          : connecting
            ? { label: "Connecting", dot: "bg-saffron", pulse: true }
            : { label: "Connected", dot: "bg-signal", pulse: false };

  const remote = peers.slice(0, 3);
  const alone = remote.length === 0;

  const gridClass = compact
    ? remote.length <= 1
      ? "grid-cols-1 grid-rows-1"
      : remote.length === 2
        ? "grid-cols-1 grid-rows-2"
        : "grid-cols-1 grid-rows-3"
    : remote.length <= 1
      ? "grid-cols-1"
      : remote.length === 2
        ? "grid-cols-1 sm:grid-cols-2"
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  const controlBtn =
    "inline-flex items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-40";
  const btnSize = compact ? "size-10" : "size-11";

  return (
    <div
      className={cn(
        "relative isolate flex flex-col overflow-hidden rounded-2xl bg-[#0f0f0f] text-white shadow-lift",
        compact ? "h-[420px]" : "h-[520px]",
        className,
      )}
    >
      {/* Stage */}
      <div className="relative min-h-0 flex-1 p-2">
        {alone ? (
          <VideoTile
            stream={localStream}
            tracks={localStream?.getTracks().length ?? 0}
            name={self.name}
            label={`${self.name} (you)`}
            role={self.role}
            videoOn={camOn}
            audioOn={micOn}
            muted
            mirrored
            className="size-full"
          />
        ) : (
          <div className={cn("grid size-full gap-2", gridClass)}>
            {remote.map((p) => (
              <VideoTile
                key={p.id}
                stream={p.stream}
                tracks={p.tracks}
                name={p.name}
                role={p.role}
                videoOn={p.video}
                audioOn={p.audio}
                connecting={p.state !== "connected"}
                className="min-h-0"
              />
            ))}
          </div>
        )}

        {/* Local picture-in-picture */}
        {!alone && (
          <VideoTile
            stream={localStream}
            tracks={localStream?.getTracks().length ?? 0}
            name={self.name}
            label="You"
            role={self.role}
            videoOn={camOn}
            audioOn={micOn}
            muted
            mirrored
            small
            className={cn(
              "absolute z-10 aspect-[4/3] border border-white/15 shadow-[0_10px_24px_-8px_rgba(0,0,0,0.7)]",
              compact ? "right-4 bottom-4 w-[34%] min-w-[92px]" : "right-4 bottom-4 w-[22%] max-w-[220px] min-w-[110px]",
            )}
          />
        )}

        {(mediaError || (alone && mediaReady)) && (
          <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex flex-col items-center gap-2 px-4">
            {alone && mediaReady && (
              <span className="rounded-full bg-black/50 px-3 py-1.5 text-center text-xs text-white/85 backdrop-blur-md">
                You are in the consult room. Others will appear here when they join.
              </span>
            )}
            {mediaError && (
              <div className="flex max-w-md items-start gap-2 rounded-xl border border-white/15 bg-black/70 px-3 py-2 text-xs text-white/85 backdrop-blur-md">
                <TriangleAlert className="mt-px size-3.5 shrink-0 text-saffron" />
                <span>
                  {mediaError}
                  {hasMic || hasCam ? "" : " You can still see and hear others."}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Control bar */}
      <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-white/5 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="flex min-w-0 items-center gap-2 text-[11px] font-medium text-white/80">
            <span className="relative flex size-2 shrink-0">
              {status.pulse && <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-70", status.dot)} />}
              <span className={cn("relative inline-flex size-2 rounded-full", status.dot)} />
            </span>
            <span className={cn("truncate", compact && "hidden sm:inline")}>{status.label}</span>
          </span>
          {!alone && (
            <span className="flex items-center gap-1 rounded-full bg-white/8 px-1.5 py-0.5 text-[11px] font-medium text-white/70 tabular-nums">
              <Users className="size-3" /> {connected + 1}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMic}
            disabled={!hasMic}
            aria-pressed={!micOn}
            aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
            title={hasMic ? (micOn ? "Mute" : "Unmute") : "No microphone"}
            className={cn(controlBtn, btnSize, micOn && hasMic ? "bg-white/12 hover:bg-white/20" : "bg-white text-danger hover:bg-white/90")}
          >
            {micOn && hasMic ? <Mic className="size-5" /> : <MicOff className="size-5" />}
          </button>
          <button
            type="button"
            onClick={toggleCam}
            disabled={!hasCam}
            aria-pressed={!camOn}
            aria-label={camOn ? "Turn camera off" : "Turn camera on"}
            title={hasCam ? (camOn ? "Stop video" : "Start video") : "No camera"}
            className={cn(controlBtn, btnSize, camOn && hasCam ? "bg-white/12 hover:bg-white/20" : "bg-white text-danger hover:bg-white/90")}
          >
            {camOn && hasCam ? <Video className="size-5" /> : <VideoOff className="size-5" />}
          </button>
          <button
            type="button"
            onClick={onLeave}
            aria-label="Leave call"
            title="Leave"
            className={cn(controlBtn, compact ? "h-10 px-4" : "h-11 px-5", "gap-2 bg-danger text-sm font-semibold hover:bg-danger-hover")}
          >
            <PhoneOff className="size-5" />
            {!compact && <span>Leave</span>}
          </button>
        </div>
        <div />
      </div>
    </div>
  );
}
