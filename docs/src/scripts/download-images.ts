import fs from 'fs/promises';
import path from 'path';

const testimonials = [
  {
    user: '@eternalmori',
    image:
      'https://yt3.ggpht.com/FqQcb-sy0kQLT_uqyRKFJfAdPLy4rmC1hGtSaiUYCFPaZn4LJXJs9hJKUH9OvqkWpsP4h-Nnhw=s88-c-k-c0x00ffffff-no-rj',
    comment:
      'Awesome! I hope this will become the most used and standard app for every app. You deserve it!',
  },
  {
    user: '@whiterabbit6768',
    image:
      'https://yt3.ggpht.com/QkUf2SDU8HfWkwyqF-xbAAvW7C0cny1lMYsg-fELHD7IB0NSutElrfBhFiwC7uM91wHECzI=s88-c-k-c0x00ffffff-no-rj',
    comment:
      'Just used this for file uploads in my new service. Really great documentation and examples. Took very little effort to integrate and test.',
  },
  {
    user: '@sathishkannan6600',
    image:
      'https://yt3.ggpht.com/ytc/AIdro_nzjrEGEW1ljvq0slQBOeXcZwQqHlmFzyPXXTdRQf6ZP8E=s88-c-k-c0x00ffffff-no-rj',
    comment:
      'Unbelievable and exhaustive features.Edge store thought about all the use cases. Also, not using a database for protected files is a nice idea. Very clear explanation in the video.',
  },
  {
    user: '@PhilippeKhin',
    image:
      'https://yt3.ggpht.com/ytc/AIdro_noIo8kfGBJIlJ3OqosAAIx0Wmce06n5_N-OYSxM5AhvGI=s88-c-k-c0x00ffffff-no-rj',
    comment:
      "Feeling that Edge Store will take off 🚀 Great stuff you're building here Ravi 👍",
  },
  {
    user: '@IyanSR',
    image:
      'https://yt3.ggpht.com/xKYOX-15awu5hHP2FWW9AWqqFcaKDrczuNUxlfRtI_9uu4_l-ExMJON4ZBgKvR9607kSaKvZXvw=s88-c-k-c0x00ffffff-no-rj',
    comment: 'My mind is blown, thanks for creating this, solve my problems',
  },
  {
    user: '@psyferinc.3573',
    image:
      'https://yt3.ggpht.com/98hAP5pldmYCboZh4VT_tiTStRQVouBzWSwTk4LHYV1tWoDcyryY1oRoMW5j_EMcypR7Q1dmsw=s88-c-k-c0x00ffffff-no-rj',
    comment:
      'i like that i have more control over my images. def migrating to this project.',
  },
  {
    user: '@santiagomanuelgonzalez9894',
    image:
      'https://yt3.ggpht.com/ytc/AIdro_kuG2GLkGHNhL1gTj6n1jiJWefqma4GHV880lifIbPWul8=s88-c-k-c0x00ffffff-no-rj',
    comment:
      "It looks great. I'm building a SaaS and I think I'm going to choose your product to handle user file uploads! I'm going to do some testing with the free version to see how it works. Thank you very much!",
  },
  {
    user: '@developerpranav',
    image:
      'https://yt3.ggpht.com/ytc/AIdro_kA5_GhiyHqNvdgi44X2S1x2fkUP98mX--QS0B_N9xNGPs=s88-c-k-c0x00ffffff-no-rj',
    comment:
      '🤯 Blown away by the simplicity of defining the types of asset uploaded, which then determines the file path. Awesome video, and amazing job on Edge Store btw! Highly considering it for my current project! Just one question, can I use my own S3 Bucket? Specifically, I use Cloudflare R2 which has compatibility with the S3 API.',
  },
  {
    user: '@ryanpp27',
    image:
      'https://yt3.ggpht.com/zJuqLs4z-nKc9kKOj_ARHui-beW24uqORxfftkcW1ckJ_C2agyMbezHQPpoODBOw50wwZdPu-w=s88-c-k-c0x00ffffff-no-rj',
    comment: 'Wow, just wow! thank you bro! edgestore save my day',
  },
  {
    user: '@yelchat',
    image:
      'https://yt3.ggpht.com/uwdK03x_P07MxggW6Z2ff7obAR-ZFcvQOaB4U2BLkwp3K7rJQbomZ2DOrIPPUb8Iz6m-5GjNlg=s88-c-k-c0x00ffffff-no-rj',
    comment: 'Wonderful... 🎉, starting to use this asap',
  },
  {
    user: '@nayanxchandrakar',
    image:
      'https://yt3.ggpht.com/5cJqNcBNbaAaE7EwUNwVoBEb9DmP7bgaoDP_wagXIkbqwapwgv3UdEOCdFEQH1UkNWiQW-q5NhM=s88-c-k-c0x00ffffff-no-rj',
    comment:
      'Yes I used it on my airbnb clone project thanks ravi love from india',
  },
  {
    user: '@emmanuelesekhaigbe7040',
    image:
      'https://yt3.ggpht.com/ytc/AIdro_meXZ1fODTPw3-cA5LY6hhfMqA-oQxjdqhXwXdl_gD-36Q=s88-c-k-c0x00ffffff-no-rj',
    comment: "I'm definitely using this, thanks bro",
  },
  {
    user: '@MyBusiness-d8k',
    image:
      'https://yt3.ggpht.com/ytc/AIdro_meZQDvkVwIytlz05tUr4sKYRoxduo30MYm6fDWZDFwo5Dx5x44u4bpmQY2f_R4uW4yGQ=s88-c-k-c0x00ffffff-no-rj',
    comment:
      'i use cloudinary built-in components and its work perfect but its just expose my API key. this video is so helpful for me and now i can use it safely in my apps ✔✔✔✔',
  },
  {
    user: '@kienantran2048',
    image:
      'https://yt3.ggpht.com/ytc/AIdro_mYZvskDynY3gCVwLnm3Dvo4lfwJGfZ-ak9CST3G6k=s88-c-k-c0x00ffffff-no-rj',
    comment: 'Awesome product! Probably use it in my coming project',
  },
  {
    user: '@namacharyadas',
    image:
      'https://yt3.ggpht.com/CtAzUxfVz5LaAegBnHlcz2K00r6iPB2o5kdmFtl7Dgf4FC4Juj-rv2WHOIdub6fmbQzkLmVb=s88-c-k-c0x00ffffff-no-rj',
    comment: 'Love it! Good luck to you! Rooting for edgestore!',
  },
  {
    user: '@alijansoomro4277',
    image:
      'https://yt3.ggpht.com/ytc/AIdro_lBj2_SaydLARaf_VD4cxIDjF_cmHeL_5YSGeFUIfycc9w=s88-c-k-c0x00ffffff-no-rj',
    comment:
      'This service looks easier to use than UploadThing — I was looking for a better way to upload files in Next-JS, and I like Edge Store.',
  },
  {
    user: '@hikmatullah2131',
    image:
      'https://yt3.ggpht.com/NLFF28hZDwFf8SnxYbPyiTb9Gzg8jxa3mfC_4OYmo2gOuHmyuVTXWc9XMHgaJQAsoeBPQkXz4g=s88-c-k-c0x00ffffff-no-rj',
    comment: 'You covered a lot in a short time, and I love Edge Store too.',
  },
];

const OUTPUT_DIR = path.join(__dirname, '../../public/img/testimonials');

async function downloadImages() {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`Output directory created/ensured at: ${OUTPUT_DIR}`);

    for (const testimonial of testimonials) {
      const { user, image: imageUrl } = testimonial;

      // Sanitize username for filename
      const username = user.startsWith('@') ? user.substring(1) : user;
      const sanitizedUsername = username.replace(/[^a-zA-Z0-9_-]/g, '_');

      try {
        console.log(`Fetching image for ${user} from ${imageUrl}`);
        const response = await fetch(imageUrl);

        if (!response.ok) {
          console.error(
            `Failed to fetch image for ${user} (${imageUrl}): ${response.status} ${response.statusText}`,
          );
          continue;
        }

        const contentType = response.headers.get('content-type');
        let extension = '.jpg'; // Default extension
        if (contentType) {
          if (contentType.includes('image/jpeg')) {
            extension = '.jpg';
          } else if (contentType.includes('image/png')) {
            extension = '.png';
          } else if (contentType.includes('image/webp')) {
            extension = '.webp';
          } else if (contentType.includes('image/gif')) {
            extension = '.gif';
          } else {
            console.warn(
              `Unknown content type for ${user} (${imageUrl}): ${contentType}. Defaulting to .jpg`,
            );
          }
        } else {
          console.warn(
            `No content type found for ${user} (${imageUrl}). Defaulting to .jpg`,
          );
        }

        const fileName = `${sanitizedUsername}${extension}`;
        const filePath = path.join(OUTPUT_DIR, fileName);

        // Node-fetch specific: Get ArrayBuffer and convert to Buffer
        const imageBuffer = await response.arrayBuffer();
        await fs.writeFile(filePath, new Uint8Array(imageBuffer));
        console.log(`Successfully downloaded and saved: ${filePath}`);
      } catch (error) {
        console.error(
          `Error processing image for ${user} (${imageUrl}):`,
          error,
        );
      }
    }
    console.log('All images processed.');
  } catch (error) {
    console.error('An error occurred during the download process:', error);
  }
}

void downloadImages();
