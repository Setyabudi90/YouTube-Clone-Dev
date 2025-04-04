"use client";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

import Comments from "@/components/comments";
import RelatedVideos from "@/components/related-videos";
import { usePiP } from "@/contexts/PIPContext";
import { formatPublishedDate, formatViews } from "@/lib/utils";
import {
  checkSubscription,
  dislikeVideo,
  getLikeStatus,
  likeVideo,
  removeLike,
  subscribeChannel,
  unsubscribeChannel,
} from "@/lib/youtube-api";
import {
  ArrowRight,
  CircleCheck,
  Download,
  MoreHorizontal,
  Share2Icon,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface VideoDetails {
  id: string;
  snippet: {
    title: string;
    description: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
  };
  statistics: {
    viewCount: string;
    likeCount: string;
  };
}

interface ChannelDetails {
  id: string;
  snippet: {
    title: string;
    thumbnails: {
      default: { url: string };
    };
    customUrl?: string;
  };
  statistics: {
    subscriberCount: string;
  };
}

interface VideoPlayerProps {
  initialVideo: VideoDetails;
  channelDetails: ChannelDetails;
  videoId: string;
}

export default function VideoPlayer({
  initialVideo,
  channelDetails,
  videoId,
}: VideoPlayerProps) {
  const [video] = useState<VideoDetails>(initialVideo);
  const { data: session } = useSession();
  const [limit, setLimit] = useState<number>(50);
  const [isSubs, setIsSubs] = useState<boolean>(false);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [liked, setLiked] = useState<boolean>(false);
  const [disliked, setDisliked] = useState<boolean>(false);
  const playerRef = useRef<any>(null);
  const { isPiP, setIsPiP, setVideoId, setVideoTime, videoTime } = usePiP();
  const router = useRouter();
  if (typeof window !== "undefined") document.title = video.snippet.title;

  const handleSetLimit = () => {
    setLimit(limit === 50 ? video.snippet.description.length : 50);
  };

  const displayText = (text: string, limit: number) => {
    if (text) {
      return text.length > limit ? text.slice(0, limit) + "..." : text;
    }
    return "No description available.";
  };

  const handleShare = () => {
    navigator
      .share({
        title: video.snippet.title,
        url: `${window.location.href}`,
      })
      .then(() => console.log("Successful share"))
      .catch((error) => console.log("Error sharing:", error));
  };

  useEffect(() => {
    if (session && session.accessToken) {
      checkSubscription(channelDetails.id, session.accessToken).then(
        (subId) => {
          if (subId) {
            setIsSubs(true);
            setSubscriptionId(subId);
          }
        }
      );
    }
  }, [session, channelDetails.id]);

  useEffect(() => {
    if (session?.accessToken) {
      const fetchLikeStatus = async () => {
        try {
          const status = await getLikeStatus(videoId, session!.accessToken);
          setLiked(status === "like");
          setDisliked(status === "dislike");
        } catch (error) {
          console.error("Gagal cek status like:", error);
        }
      };

      fetchLikeStatus();
    }
  }, [videoId, session]);

  useEffect(() => {
    if (!window.YT) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.body.appendChild(script);
    }
    window.onYouTubeIframeAPIReady = () => {
      createPlayer();
    };

    if (window.YT && window.YT.Player) {
      createPlayer();
    }
  }, [isPiP, videoId]);

  const createPlayer = () => {
    if (!window.YT || !window.YT.Player) return;
    playerRef.current = new window.YT.Player("youtube-player", {
      videoId,
      playerVars: { autoplay: 1, rel: 0 },
      events: {
        onReady: (event: YT.PlayerEvent) => {
          playerRef.current = event.target;
          event.target.seekTo(videoTime, true);
        },
      },
    });
  };

  const handlePiP = () => {
    if (playerRef.current) {
      setVideoTime(playerRef.current.getCurrentTime());
      setVideoId(videoId);
      setIsPiP(true);
      router.back();
    }
  };

  const handleSubscribeToggle = async (): Promise<void> => {
    if (!session || !session.accessToken) return;

    if (isSubs && subscriptionId) {
      const success = await unsubscribeChannel(
        subscriptionId,
        session.accessToken
      );
      if (success) {
        setIsSubs(false);
        setSubscriptionId(null);
      }
    } else {
      const newSubId = await subscribeChannel(
        channelDetails.id,
        session.accessToken
      );
      if (newSubId) {
        setIsSubs(true);
        setSubscriptionId(newSubId);
      }
    }
  };

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!session?.accessToken) return;

    const actionType =
      (e.currentTarget.getAttribute("data-type") as
        | "like"
        | "dislike"
        | "none") ?? "none";

    try {
      if (actionType === "like") {
        if (liked) {
          await removeLike(videoId, session.accessToken);
          setLiked(false);
        } else {
          await likeVideo(videoId, session.accessToken);
          setLiked(true);
          setDisliked(false);
        }
      } else if (actionType === "dislike") {
        if (disliked) {
          await removeLike(videoId, session.accessToken);
          setDisliked(false);
        } else {
          await dislikeVideo(videoId, session.accessToken);
          setDisliked(true);
          setLiked(false);
        }
      }
    } catch (error) {
      console.error("Error saat toggle like/dislike:", error);
    }
  };

  const isVerified =
    parseInt(channelDetails.statistics.subscriberCount) > 100000 &&
    channelDetails.snippet.customUrl;

  const hasVevo = video.snippet.channelTitle;

  return (
    <div className="flex flex-col lg:flex-row gap-8 overflow-hidden">
      <div className="lg:w-2/3">
        {!isPiP ? (
          <div className="md:aspect-video w-auto h-auto overflow-hidden rounded-lg relative group">
            {/* <iframe
            width="100%"
            height="100%"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-[300px] md:h-full"
          ></iframe> */}
            <div
              id="youtube-player"
              className="w-full h-[300px] md:h-full"
            ></div>
            <div className="absolute flex left-0 top-[8rem] md:top-[12rem] gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <button
                className="text-white relative"
                onClick={handlePiP}
                title="Open Super Picture in Picture Mode"
              >
                <ArrowRight className="md:w-5 md:h-5 h-[1.5rem] w-[1.5rem]" />
              </button>
            </div>
          </div>
        ) : (
          <p className="capitalize text-sm w-full h-[300px] md:h-full">
            the video is playing in picture in picture
          </p>
        )}
        <h1
          className="md:text-2xl text-xl font-bold mt-4"
          title={video.snippet.title}
        >
          {video.snippet.title}
        </h1>
        <div className="flex items-center justify-between mt-4 flex-col md:flex-row">
          <div className="flex items-center justify-between space-x-4 w-full md:w-auto">
            <div className="flex gap-2 items">
              <div
                className="layer rounded-full overflow-hidden"
                style={{ width: "40px", height: "40px", pointerEvents: "none" }}
                onContextMenu={(e) => e.preventDefault()}
              >
                <img
                  src={channelDetails.snippet.thumbnails.default.url}
                  alt={channelDetails.snippet.title}
                  loading="lazy"
                  decoding="async"
                  className="!rounded-full w-[40px] h-[40px] flex-shrink-0"
                />
              </div>
              <Link href={`/channel/${channelDetails.id}`}>
                <h2
                  className="font-semibold flex items-center cursor-pointer gap-1"
                  title={channelDetails.snippet.title}
                >
                  {video.snippet.channelTitle.length > 13 || hasVevo
                    ? video.snippet.channelTitle
                        .replace(/VEVO$/, "")
                        .slice(0, 13) + ".."
                    : video.snippet.channelTitle}
                  {hasVevo.includes("VEVO") && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-[.5rem] text-black dark:text-white"
                      viewBox="0 0 1508.2414 380"
                      fill="currentColor"
                    >
                      <path d="M1318.241 0a190 190 0 1 0 190 190 190 190 0 0 0-190-190Zm0 278.667c-47.504 0-82.333-38-82.333-88.667s34.859-88.667 82.333-88.667 82.333 38.008 82.333 88.667-34.833 88.667-82.333 88.667Zm-557.333-88.667c0-104.935-82.23-190-183.667-190s-183.667 85.065-183.667 190 82.321 190 186.833 190c83.477 0 148.939-50.454 170.716-120.333H640.575c-15.337 22.692-37.888 28.5-60.167 28.5-42.728 0-69.955-29.41-78.499-69.667h256.936a198 198 0 0 0 2.063-28.5ZM577.242 88.667c36.647 0 65.049 25.245 73.756 63.333H503.34c9.857-39.593 36.098-63.333 73.902-63.333ZM209.908 376.833 0 11.083h123.586l86.322 166.25 86.323-166.25h123.586Zm734.667 0L734.667 11.083h123.587l86.321 166.25 86.323-166.25h123.587Z" />
                    </svg>
                  )}
                  {isVerified && (
                    <CircleCheck
                      color="currentColor"
                      className="h-4 w-4 text-indigo-500 rounded-full"
                    />
                  )}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {formatViews(
                    Number.parseInt(channelDetails.statistics.subscriberCount)
                  )}{" "}
                  subscribers
                </p>
              </Link>
            </div>
            <button
              type="button"
              title={`${isSubs ? "Unsubscribe" : "Subscribe"} to ${
                video.snippet.channelTitle
              }`}
              onClick={handleSubscribeToggle}
              className={`px-4 py-2 rounded-full flex items-center space-x-2 text-sm  ${
                isSubs
                  ? "bg-[#272829] text-white"
                  : "text-white bg-[#060606] dark:bg-white  dark:text-black"
              }`}
            >
              {isSubs ? "Subscribed" : "Subscribe"}
            </button>
          </div>
          <div
            className="flex items-center md:justify-evenly justify-between w-full md:w-auto mt-4 md:mt-0 overflow-x-auto md:oveflow-x-none"
            id="ytc-content-renderer"
          >
            <div className="flex items-center rounded-full bg-slate-200 dark:bg-[#272928] text-black dark:text-white px-4 py-2 text-sm gap-2">
              <button
                className="flex items-center cursor-pointer"
                data-type="like"
                onClick={handleClick}
                title={!liked ? "Like Video" : "Cancel Like Video"}
              >
                <ThumbsUp
                  className={`${
                    liked ? "dark:text-indigo-500 text-blue-500" : ""
                  } mr-2 h-4 w-4`}
                />
                {formatViews(Number.parseInt(video.statistics.likeCount))}
              </button>
              {"|"}
              <button
                data-type="dislike"
                onClick={handleClick}
                title={!disliked ? "dislike Video" : "Cancel Dislike Video"}
              >
                <ThumbsDown
                  className={`${disliked ? "text-red-500" : ""} h-4 w-4`}
                />
              </button>
            </div>
            <button
              className="cursor-pointer dark:bg-[#272928] bg-slate-200 text-black dark:text-white px-4 py-2 rounded-full flex items-center space-x-2 text-sm ml-2"
              onClick={() => handleShare()}
            >
              <Share2Icon className="cursor-pointer mr-2 h-4 w-4" />
              Share
            </button>
            <button className="cursor-pointer dark:bg-[#272928] bg-slate-200 text-black flex dark:text-white px-4 py-2 rounded-full items-center space-x-2 text-sm ml-2">
              <Download className="cursor-pointer mr-2 h-4 w-4" />
              Download
            </button>
            <button className="cursor-pointer dark:bg-[#272928] bg-slate-200 text-black dark:text-white p-2 rounded-full items-center text-sm  ml-2 flex">
              <MoreHorizontal className="cursor-pointer h-4 w-4" />
            </button>
          </div>
        </div>
        <div
          className="mt-4 text-sm whitespace-pre-wrap dark:bg-[#272829] bg-slate-200 cursor-pointer p-4 rounded-lg"
          onClick={handleSetLimit}
        >
          <p className="text-md mb-4 text-black dark:text-white">
            {video.statistics
              ? `${Number.parseInt(video.statistics.viewCount).toLocaleString(
                  "id-ID"
                )} x views  `
              : ""}
            {formatPublishedDate(new Date(video.snippet.publishedAt))}
          </p>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            className="prose dark:prose-invert prose-p:m-0 prose-h1:m-0 prose-h2:m-0 prose-h3:m-0 prose-h4:m-0 prose-h5:m-0 prose-h6:m-0 prose-a:m-0 prose-ul:m-0 prose-li:m-0 prose-ol:m-0 overflow-hidden word-break break-words"
            children={displayText(video.snippet.description, limit)}
          />
        </div>
        <div className="mt-4">
          <Comments
            videoId={videoId}
            authorChannelId={video.snippet.channelId}
          />
        </div>
      </div>
      <div className="lg:w-1/3">
        <RelatedVideos currentVideoTitle={video.snippet.title} />
      </div>
    </div>
  );
}
