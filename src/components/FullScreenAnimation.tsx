import React, { useRef } from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

interface FullScreenAnimationProps {
    src: string;
    title: string;
    description: string;
    loop?: boolean;
}

export const FullScreenAnimation: React.FC<FullScreenAnimationProps> = ({
    src,
    title,
    description,
    loop = false,
}) => {
    const ref = useRef<any>(null);

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white dark:bg-gray-900 transition-colors duration-200">
            <DotLottieReact
                src={src}
                autoplay
                loop={loop}
                style={{ width: 260, height: 260 }}
                dotLottieRefCallback={(dotLottie) => {
                    ref.current = dotLottie;
                }}
            />
            <h2 className="mt-6 text-xl font-semibold text-center text-gray-900 dark:text-white px-4">
                {title}
            </h2>
            <p className="mt-2 text-gray-600 dark:text-gray-300 text-center max-w-xs px-4 whitespace-pre-wrap">
                {description}
            </p>
        </div>
    );
};
