'use client';

import { AnimatedGrid, AnimatedGridItem } from '@/components/animated-grid';
import { DevtoIcon } from '@/components/icons/platforms/devto';
import { TwitterIcon } from '@/components/icons/platforms/twitter';
import { YoutubeIcon } from '@/components/icons/platforms/youtube';
import Link from 'next/link';

const testimonials = [
  {
    user: '@eternalmori',
    image: '/img/testimonials/eternalmori.jpg',
    comment:
      'Awesome! I hope this will become the most used and standard app for every app. You deserve it!',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU&lc=UgzfjRCDsZLHxP4VuJN4AaABAg',
  },
  {
    user: '@whiterabbit6768',
    image: '/img/testimonials/whiterabbit6768.jpg',
    comment:
      'Just used this for file uploads in my new service. Really great documentation and examples. Took very little effort to integrate and test.',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU&lc=UgyJnQai0M6X0LrhAzN4AaABAg',
  },
  {
    user: '@sathishkannan6600',
    image: '/img/testimonials/sathishkannan6600.jpg',
    comment:
      'Unbelievable and exhaustive features.Edge store thought about all the use cases. Also, not using a database for protected files is a nice idea. Very clear explanation in the video.',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU&lc=Ugw4ne4z1Pj3NS_MGbB4AaABAg',
  },
  {
    user: '@raus_raay',
    image: '/img/testimonials/raus_raay.webp',
    comment:
      '🚀 Loving EdgeStore - super convenient cloud storage for web apps! ☁️ Easy integration & no complex setup. Perfect for hassle-free data management.',
    platform: 'twitter',
    url: 'https://x.com/raus_raay/status/1848031922154607006',
  },
  {
    user: '@PhilippeKhin',
    image: '/img/testimonials/PhilippeKhin.jpg',
    comment:
      "Feeling that Edge Store will take off 🚀 Great stuff you're building here Ravi 👍",
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU&lc=UgyEH4ERhW0fXigeWN14AaABAg',
  },
  {
    user: '@harshalranjhani',
    image: '/img/testimonials/harshalranjhani.webp',
    comment:
      'Edgestore is a terrific solution. Many configuration choices covering a wide range of use-cases have been offered  which make it super easy to use.',
    platform: 'devto',
    url: 'https://dev.to/codeparrot/nextjs-uploads-the-edge-store-boost-1o2j',
  },
  {
    user: '@IyanSR',
    image: '/img/testimonials/IyanSR.jpg',
    comment: 'My mind is blown, thanks for creating this, solve my problems',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU&lc=UgwFvjx2WAyNKZAxfnl4AaABAg',
  },
  {
    user: '@psyferinc.3573',
    image: '/img/testimonials/psyferinc_3573.jpg',
    comment:
      'i like that i have more control over my images. def migrating to this project.',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU&lc=UgxHBwzlikTWPUfF1vV4AaABAg',
  },
  {
    user: '@MarcelGatete',
    image: '/img/testimonials/MarcelGatete.jpg',
    comment:
      'I have implemented a starter boilerplate with NextAuth, Resend and EdgeStore already set-up. Makes starting a new project a whole lot painless.',
    platform: 'twitter',
    url: 'https://x.com/MarcelGatete/status/1842811671628120444',
  },
  {
    user: '@santiagomanuelgonzalez9894',
    image: '/img/testimonials/santiagomanuelgonzalez9894.jpg',
    comment:
      "It looks great. I'm building a SaaS and I think I'm going to choose your product to handle user file uploads! I'm going to do some testing with the free version to see how it works. Thank you very much!",
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU&lc=UgzwFaYeGpuXUDsmeRZ4AaABAg',
  },
  {
    user: '@developerpranav',
    image: '/img/testimonials/developerpranav.jpg',
    comment:
      '🤯 Blown away by the simplicity of defining the types of asset uploaded, which then determines the file path. Awesome video, and amazing job on Edge Store btw! Highly considering it for my current project! Just one question, can I use my own S3 Bucket? Specifically, I use Cloudflare R2 which has compatibility with the S3 API.',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU&lc=UgxL7xpOk8ygYV7iYgx4AaABAg',
  },
  {
    user: '@ryanpp27',
    image: '/img/testimonials/ryanpp27.jpg',
    comment: 'Wow, just wow! thank you bro! edgestore save my day',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU&lc=UgxDWR-0XRGICzoRU-R4AaABAg',
  },
  {
    user: '@yelchat',
    image: '/img/testimonials/yelchat.jpg',
    comment: 'Wonderful... 🎉, starting to use this asap',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU&lc=UgxJySnrg7HJD-MoQ-94AaABAg',
  },
  {
    user: '@nayanxchandrakar',
    image: '/img/testimonials/nayanxchandrakar.jpg',
    comment:
      'Yes I used it on my airbnb clone project thanks ravi love from india',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU&lc=UgwgbArtHWaL9_qbG2F4AaABAg',
  },
  {
    user: '@emmanuelesekhaigbe7040',
    image: '/img/testimonials/emmanuelesekhaigbe7040.jpg',
    comment: "I'm definitely using this, thanks bro",
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU&lc=UgwbemZmxa5mNJeH07h4AaABAg',
  },
  {
    user: '@MyBusiness-d8k',
    image: '/img/testimonials/MyBusiness-d8k.jpg',
    comment:
      'i use cloudinary built-in components and its work perfect but its just expose my API key. this video is so helpful for me and now i can use it safely in my apps ✔✔✔✔',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU&lc=UgxmYgk1ZjNcPT8dAbh4AaABAg',
  },
  {
    user: '@kienantran2048',
    image: '/img/testimonials/kienantran2048.jpg',
    comment: 'Awesome product! Probably use it in my coming project',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU&lc=UgyVaJx8_6w84JW4BWx4AaABAg',
  },
  {
    user: '@namacharyadas',
    image: '/img/testimonials/namacharyadas.jpg',
    comment: 'Love it! Good luck to you! Rooting for edgestore!',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU&lc=UgzneOGuoR5jafuMAn54AaABAg',
  },
  {
    user: '@alijansoomro4277',
    image: '/img/testimonials/alijansoomro4277.jpg',
    comment:
      'This service looks easier to use than UploadThing — I was looking for a better way to upload files in Next-JS, and I like Edge Store.',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU&lc=Ugw9Jvy13TVCEXCvftR4AaABAg',
  },
];

const platformIcons = {
  youtube: (
    <YoutubeIcon className="text-muted-foreground h-5 w-5 sm:h-6 sm:w-6" />
  ),
  twitter: (
    <TwitterIcon className="text-muted-foreground h-5 w-5 sm:h-6 sm:w-6" />
  ),
  devto: <DevtoIcon className="text-muted-foreground h-5 w-5 sm:h-6 sm:w-6" />,
};

export function Testimonials() {
  return (
    <div className="container relative flex flex-col items-center justify-center gap-6 overflow-hidden px-4 py-10 md:gap-10 md:px-8 md:py-20">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">
          Loved by{' '}
          <span className="from-primary to-primary/60 bg-gradient-to-b bg-clip-text text-transparent">
            Developers
          </span>
        </h2>
        <p className="text-muted-foreground text-base sm:text-lg">
          Here is what our users are saying about Edge Store.
        </p>
      </div>
      <AnimatedGrid>
        {testimonials.map((testimonial) => (
          <AnimatedGridItem key={testimonial.user}>
            <Link
              href={testimonial.url}
              target="_blank"
              className="flex flex-col gap-3 transition-transform duration-200 ease-in-out md:gap-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-3">
                  <img
                    src={testimonial.image}
                    alt={testimonial.user}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                  <span className="text-sm font-semibold sm:text-base">
                    {testimonial.user}
                  </span>
                </div>
                {
                  platformIcons[
                    testimonial.platform as keyof typeof platformIcons
                  ]
                }
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed sm:text-sm md:text-sm">
                {testimonial.comment}
              </p>
            </Link>
          </AnimatedGridItem>
        ))}
      </AnimatedGrid>
    </div>
  );
}
