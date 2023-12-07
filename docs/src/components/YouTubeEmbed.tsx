import React from 'react';

export default ({ width="560", height="315", videoId }) => {
    return (
        <iframe
        width={width}
        height={height}
        src={`https://www.youtube.com/embed/${videoId}?modestbranding=1`}
        title="YouTube video player"
        frameBorder="0"
        allowFullScreen
        ></iframe>
    );
};
