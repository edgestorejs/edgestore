import React from 'react';

export default () => {

  const features = [
      {
          icon:
            <svg width="35" height="35" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="0.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 1v22"></path>
            <path d="M17.5 3H10a4.5 4.5 0 1 0 0 9"></path>
            <path d="M6.5 21H14a4.5 4.5 0 1 0 0-9h-4"></path>
          </svg>,
          title: "Start for free",
          desc: "Get your free storage and start building. No credit card required."
      },
      {
          icon:
            <svg width="35" height="35" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="0.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M9.142 21.585a9.997 9.997 0 0 1-4.348-2.652 3 3 0 0 0-2.59-4.919A10.044 10.044 0 0 1 2.457 9H2.5a3 3 0 0 0 2.692-4.325A9.984 9.984 0 0 1 9.326 2.36a3 3 0 0 0 5.348 0 9.984 9.984 0 0 1 4.134 2.314A3 3 0 0 0 21.542 9a10.044 10.044 0 0 1 .255 5.015 3 3 0 0 0-2.59 4.919 9.998 9.998 0 0 1-4.349 2.651 3.001 3.001 0 0 0-5.716 0Z"></path>
            <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"></path>
            </svg>,
          title: "Effortless Integration",
          desc: "Use our type-safe npm package to seamlessly integrate Edge Store into your app."
      },
      {
          icon:
            <svg width="35" height="35" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="0.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 2.5H2v6h20v-6Z"></path>
            <path d="m2 20.515 6.088-6.15 3.29 3.15 4.021-4.015 2.24 2.184"></path>
            <path d="M22 8.086v13"></path>
            <path d="M2 8.086v7"></path>
            <path d="M6.508 21.5H22"></path>
            <path d="M8.5 5.5H19"></path>
            <path d="M5 5.498h.5"></path>
            </svg>,
          title: "Easy-to-Use Dashboard",
          desc: "Monitor, manage, and delete files with ease."
      },
      {
          icon:
            <svg width="35" height="35" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="0.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z"></path>
            <path d="M2 10.42c1.507-.712 2.622-.811 3.345-.297 1.083.77 1.22 3.909 3.684 2.409 2.464-1.5-1.056-2.112-.291-4.285.764-2.174 3.266-.485 3.515-2.866.166-1.587-1.733-2.194-5.695-1.822"></path>
            <path d="M18 4c-2.857 2.494-3.855 4-2.994 4.519 1.292.777 1.84-.317 3.417 0 1.577.317 1.236 2.454.406 2.454-.829 0-5.124-.547-4.908 1.96.217 2.506 2.8 2.877 2.8 4.278 0 .933-.572 2.362-1.715 4.286"></path>
            <path d="M3.052 16.463c.456-.198.799-.344 1.028-.437 1.924-.777 3.35-.96 4.282-.55 1.646.727 1.013 2.194 1.529 2.735.515.54 1.803.383 1.803 1.411 0 .686-.23 1.46-.69 2.323"></path>
            </svg>,
          title: "Fast CDN",
          desc: "All your files are served from the edge for a great performance anywhere in the world."
      },
      {
          icon:
            <svg width="35" height="35" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="0.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 2H3v5h18V2Z"></path>
            <path d="M21 9.5H3v5h18v-5Z"></path>
            <path d="M21 17H3v5h18v-5Z"></path>
            <path d="M10.5 4.5h3"></path>
            <path d="M10.5 12h3"></path>
            <path d="M10.5 19.5h3"></path>
            </svg>,
          title: "Large file support",
          desc: "Automatically uses multipart uploads for bigger files."
      },
      {
          icon:
            <svg width="35" height="35" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="0.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M21.5 11.5V7a1 1 0 0 0-1-1H12L9.5 3h-6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1H11"></path>
            <path d="M21.5 17h-7v4h7v-4Z"></path>
            <path d="M19.5 17v-1.5a1.5 1.5 0 1 0-3 0V17"></path>
            </svg>,
          title: "Protected Files",
          desc: "Ensure your files are safe with custom edge validations."
      },
      {
          icon:
            <svg width="35" height="35" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="0.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 22h14a1 1 0 0 0 1-1V7h-5V2H5a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1Z"></path>
            <path d="m15 2 5 5"></path>
            <path d="M9 10.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"></path>
            <path d="M7.5 14v4.5h9v-8l-4.755 5.25L7.5 14Z"></path>
            </svg>,
          title: "Automatic Thumbnail Generation",
          desc: "Images ready to use, without the extra effort."
      },
      {
          icon:
            <svg width="35" height="35" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="0.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="m8 6.5-6 6.216L8 18.5"></path>
            <path d="m16 6.5 6 6.216-6 5.784"></path>
            <path d="m14 2-3.5 20"></path>
            </svg>,
          title: "Customizable Components",
          desc: "Just copy one of our sample components and customize it to your needs."
      },
      {
          icon:
            <svg width="35" height="35" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="0.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 2H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1Z"></path>
            <path d="M9 14H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1Z"></path>
            <path d="M21 2h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1Z"></path>
            <path d="M14 14h8"></path>
            <path d="M18 18h4"></path>
            <path d="M14 22h8"></path>
            </svg>,
          title: "And More...",
          desc: "Temporary files, parallel uploads, and much more. Handle all scenarios with finesse."
      },
  ]

  return (
      <section className="relative">
        <div className="absolute opacity-60 inset-0 m-auto max-w-xs h-[357px] blur-[118px] sm:max-w-md md:max-w-lg" style={{ background: "linear-gradient(106.89deg, rgba(192, 132, 252, 0.11) 15.73%, rgba(14, 165, 233, 0.41) 15.74%, rgba(232, 121, 249, 0.26) 56.49%, rgba(79, 70, 229, 0.4) 115.91%)" }}></div>

          <div className="max-w-screen-xl mx-auto px-4 text-gray-200 md:px-8">
              <div className="relative max-w-2xl mx-auto sm:text-center">
                  <div className="relative z-10">
                      <h3 className="text-gray-300 text-3xl font-semibold sm:text-4xl">
                          Do more with less complexity
                      </h3>
                      <p className="mt-3">
                        EdgeStore provides this core features allowing you and you'r team building upload functionality faster.
                        Core EdgeStore Features.
                      </p>
                  </div>
                  <div className="absolute inset-0 max-w-xs mx-auto h-44 blur-[118px]" style={{ background: "linear-gradient(152.92deg, rgba(192, 132, 252, 0.2) 4.54%, rgba(232, 121, 249, 0.26) 34.2%, rgba(192, 132, 252, 0.1) 77.55%)" }}></div>
              </div>
              <div className="relative mt-12">
                  <ul className="grid gap-x-0 sm:gap-x-8 gap-8 sm:grid-cols-2 lg:grid-cols-3 list-none pl-0">
                      {
                        features.map((item, idx) => (
                            <li key={idx} className="group backdrop-blur-[2px] space-y-3 p-4 transition-colors duration-200 cursor-pointer border rounded-lg"
                                style={{
                                    border: "1px solid #222"
                                }}
                            >
                                <div className=" transition-color duration-200 group-hover:text-white group-hover:drop-shadow-2xl text-indigo-300 pb-3">
                                    {item.icon}
                                </div>
                                <h4 className="text-lg text-gray-100 font-semibold">
                                    {item.title}
                                </h4>
                                <p className='pb-3'>
                                    {item.desc}
                                </p>
                            </li>
                        ))
                      }
                  </ul>
              </div>
          </div>
      </section>
  )
}