"use client";

import { useEffect, useState } from "react";
import { formatViews, formatPublishedDate } from "@/lib/utils";
import RelatedVideos from "@/components/related-videos";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import {
  Share2Icon,
  ThumbsUp,
  ThumbsDown,
  MoreHorizontal,
  Download,
  CircleCheck,
} from "lucide-react";
import Comments from "@/components/comments";
import {
  subscribeChannel,
  checkSubscription,
  unsubscribeChannel,
} from "@/lib/youtube-api";
import { useSession } from "next-auth/react";

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
        text: video.snippet.description,
        url: `\n\n${window.location.href}`,
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

  const isVerified =
    parseInt(channelDetails.statistics.subscriberCount) > 100000 &&
    channelDetails.snippet.customUrl;

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      <div className="lg:w-2/3">
        <div className="md:aspect-video w-auto h-auto overflow-hidden rounded-lg">
          <iframe
            width="100%"
            height="100%"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-[300px] md:h-full"
          ></iframe>
        </div>
        <h1 className="md:text-2xl text-xl font-bold mt-4">
          {video.snippet.title}
        </h1>
        <div className="flex items-center justify-between mt-4 flex-col md:flex-row">
          <div className="flex items-center justify-between space-x-4 w-full md:w-auto w-full">
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
                  {video.snippet.channelTitle.length > 13
                    ? video.snippet.channelTitle.slice(0, 13) + ".."
                    : video.snippet.channelTitle}
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
              className={`px-4 py-2 rounded-full flex items-center space-x-2 text-sm text-white ${
                isSubs
                  ? "bg-gray-800 text-white"
                  : "bg-[#060606] dark:bg-white text-white dark:text-black"
              }`}
            >
              {isSubs ? "Subscribed" : "Subscribe"}
            </button>
          </div>
          <div className="flex items-center md:justify-evenly justify-between w-full md:w-auto mt-4 md:mt-0">
            <div className="flex items-center rounded-full bg-slate-200 dark:bg-[#272928] text-black dark:text-white px-4 py-2 text-sm gap-2">
              <button className="flex items-center cursor-pointer">
                <ThumbsUp className="mr-2 h-4 w-4" />
                {formatViews(Number.parseInt(video.statistics.likeCount))}
              </button>
              {"|"}
              <button>
                <ThumbsDown className=" h-4 w-4" />
              </button>
            </div>
            <button
              className="cursor-pointer dark:bg-[#272928] bg-slate-200 text-black dark:text-white px-4 py-2 rounded-full flex items-center space-x-2 text-sm ml-2"
              onClick={() => handleShare()}
            >
              <Share2Icon className="cursor-pointer mr-2 h-4 w-4" />
              Share
            </button>
            <button className="cursor-pointer dark:bg-[#272928] bg-slate-200 text-black flex lg:hidden dark:text-white px-4 py-2 rounded-full flex items-center space-x-2 text-sm ml-2">
              <Download className="cursor-pointer mr-2 h-4 w-4" />
              Unduh
            </button>
            <button className="cursor-pointer dark:bg-[#272928] bg-slate-200 text-black dark:text-white p-2 rounded-full flex items-center text-sm  ml-2 hidden lg:flex">
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
