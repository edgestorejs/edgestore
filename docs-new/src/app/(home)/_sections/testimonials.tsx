'use client';

import { AnimatedGrid, AnimatedGridItem } from '@/components/animated-grid';
import { DevtoIcon } from '@/components/icons/platforms/devto';
import { TwitterIcon } from '@/components/icons/platforms/twitter';
import { YoutubeIcon } from '@/components/icons/platforms/youtube';
import Image from 'next/image';
import Link from 'next/link';

const testimonials = [
  {
    user: '@eternalmori',
    image: '/images/testimonials/eternalmori.jpg',
    comment:
      'Awesome! I hope this will become the most used and standard app for every app. You deserve it!',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU',
  },
  {
    user: '@whiterabbit6768',
    image: '/images/testimonials/whiterabbit6768.jpg',
    comment:
      'Just used this for file uploads in my new service. Really great documentation and examples. Took very little effort to integrate and test.',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU',
  },
  {
    user: '@sathishkannan6600',
    image: '/images/testimonials/sathishkannan6600.jpg',
    comment:
      'Unbelievable and exhaustive features.Edge store thought about all the use cases. Also, not using a database for protected files is a nice idea. Very clear explanation in the video.',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU',
  },
  {
    user: '@PhilippeKhin',
    image: '/images/testimonials/PhilippeKhin.jpg',
    comment:
      "Feeling that Edge Store will take off 🚀 Great stuff you're building here Ravi 👍",
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU',
  },
  {
    user: '@IyanSR',
    image: '/images/testimonials/IyanSR.jpg',
    comment: 'My mind is blown, thanks for creating this, solve my problems',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU',
  },
  {
    user: '@psyferinc.3573',
    image: '/images/testimonials/psyferinc_3573.jpg',
    comment:
      'i like that i have more control over my images. def migrating to this project.',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU',
  },
  {
    user: '@santiagomanuelgonzalez9894',
    image: '/images/testimonials/santiagomanuelgonzalez9894.jpg',
    comment:
      "It looks great. I'm building a SaaS and I think I'm going to choose your product to handle user file uploads! I'm going to do some testing with the free version to see how it works. Thank you very much!",
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU',
  },
  {
    user: '@developerpranav',
    image: '/images/testimonials/developerpranav.jpg',
    comment:
      '🤯 Blown away by the simplicity of defining the types of asset uploaded, which then determines the file path. Awesome video, and amazing job on Edge Store btw! Highly considering it for my current project! Just one question, can I use my own S3 Bucket? Specifically, I use Cloudflare R2 which has compatibility with the S3 API.',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU',
  },
  {
    user: '@ryanpp27',
    image: '/images/testimonials/ryanpp27.jpg',
    comment: 'Wow, just wow! thank you bro! edgestore save my day',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU',
  },
  {
    user: '@yelchat',
    image: '/images/testimonials/yelchat.jpg',
    comment: 'Wonderful... 🎉, starting to use this asap',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU',
  },
  {
    user: '@nayanxchandrakar',
    image: '/images/testimonials/nayanxchandrakar.jpg',
    comment:
      'Yes I used it on my airbnb clone project thanks ravi love from india',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU',
  },
  {
    user: '@emmanuelesekhaigbe7040',
    image: '/images/testimonials/emmanuelesekhaigbe7040.jpg',
    comment: "I'm definitely using this, thanks bro",
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU',
  },
  {
    user: '@MyBusiness-d8k',
    image: '/images/testimonials/MyBusiness-d8k.jpg',
    comment:
      'i use cloudinary built-in components and its work perfect but its just expose my API key. this video is so helpful for me and now i can use it safely in my apps ✔✔✔✔',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU',
  },
  {
    user: '@kienantran2048',
    image: '/images/testimonials/kienantran2048.jpg',
    comment: 'Awesome product! Probably use it in my coming project',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU',
  },
  {
    user: '@namacharyadas',
    image: '/images/testimonials/namacharyadas.jpg',
    comment: 'Love it! Good luck to you! Rooting for edgestore!',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU',
  },
  {
    user: '@alijansoomro4277',
    image: '/images/testimonials/alijansoomro4277.jpg',
    comment:
      'This service looks easier to use than UploadThing — I was looking for a better way to upload files in Next-JS, and I like Edge Store.',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU',
  },
  {
    user: '@hikmatullah2131',
    image: '/images/testimonials/hikmatullah2131.jpg',
    comment: 'You covered a lot in a short time, and I love Edge Store too.',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=Acq9UEA2akU',
  },
  {
    user: '@raus_raay',
    image: '/images/testimonials/raus_raay.webp',
    comment:
      '🚀 Loving EdgeStore - super convenient cloud storage for web apps! ☁️ Easy integration & no complex setup. Perfect for hassle-free data management.',
    platform: 'twitter',
    url: 'https://x.com/raus_raay/status/1848031922154607006',
  },
  {
    user: '@MarcelGatete',
    image: '/images/testimonials/MarcelGatete.jpg',
    comment:
      'I have implemented a starter boilerplate with NextAuth, Resend and EdgeStore already set-up. Makes starting a new project a whole lot painless.',
    platform: 'twitter',
    url: 'https://x.com/MarcelGatete/status/1842811671628120444',
  },
  {
    user: '@harshalranjhani',
    image: '/images/testimonials/harshalranjhani.webp',
    comment:
      'Edgestore is a terrific solution. Many configuration choices covering a wide range of use-cases have been offered  which make it super easy to use.',
    platform: 'devto',
    url: 'https://dev.to/codeparrot/nextjs-uploads-the-edge-store-boost-1o2j',
  },
];

const platformIcons = {
  youtube: <YoutubeIcon className="h-6 w-6" />,
  twitter: <TwitterIcon className="h-6 w-6" />,
  devto: <DevtoIcon className="h-6 w-6" />,
};

export function Testimonials() {
  return (
    <div className="relative flex flex-col items-center justify-center gap-10 py-10 md:py-20">
      <div className="space-y-2 text-center">
        <h2 className="text-3xl font-bold md:text-4xl">
          Loved by{' '}
          <span className="bg-gradient-to-b from-primary to-primary/60 bg-clip-text text-transparent">
            Developers
          </span>
        </h2>
        <p className="text-lg text-muted-foreground">
          Here is what our users are saying about Edge Store.
        </p>
      </div>
      <AnimatedGrid speed="slow">
        {testimonials.map((testimonial) => (
          <AnimatedGridItem key={testimonial.user}>
            <Link
              href={testimonial.url}
              target="_blank"
              className="flex flex-col gap-4 transition-transform duration-200 ease-in-out group-hover:scale-105"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Image
                    src={testimonial.image}
                    alt={testimonial.user}
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                  <span className="font-semibold">{testimonial.user}</span>
                </div>
                {
                  platformIcons[
                    testimonial.platform as keyof typeof platformIcons
                  ]
                }
              </div>
              <p className="text-sm text-muted-foreground">
                {testimonial.comment}
              </p>
            </Link>
          </AnimatedGridItem>
        ))}
      </AnimatedGrid>
    </div>
  );
}
