// export const getClientRects = (range: Range, pages: any[]): Array<any> => {
//   const clientRects = Array.from(range.getClientRects());
//   const rects: any[] = [];

//   clientRects.forEach((clientRect) => {
//     pages.forEach((page) => {
//       const pageRect = page.node.getBoundingClientRect();

//       if (
//         clientRect.top >= pageRect.top &&
//         clientRect.bottom <= pageRect.bottom &&
//         clientRect.right <= pageRect.right &&
//         clientRect.left >= pageRect.left
//       ) {
//         rects.push({
//           top: clientRect.top + page.node.scrollTop - pageRect.top,
//           left: clientRect.left + page.node.scrollLeft - pageRect.left,
//           width: clientRect.width,
//           height: clientRect.height,
//           pageNumber: page.number,
//         });
//       }
//     });
//   });

//   return rects;
// };

export const getClientRects = (range: Range, pages: any[], scale: number): Array<any> => {
  const clientRects = Array.from(range.getClientRects());
  const rects: any[] = [];

  clientRects.forEach((clientRect) => {
    pages.forEach((page) => {
      const pageRect = page.node.getBoundingClientRect();

      if (
        clientRect.top >= pageRect.top &&
        clientRect.bottom <= pageRect.bottom &&
        clientRect.right <= pageRect.right &&
        clientRect.left >= pageRect.left
      ) {
        // Normalize the rects by dividing them by the current zoom scale to store them in unscaled dimensions
        rects.push({
          top: (clientRect.top + page.node.scrollTop - pageRect.top) / scale,
          left: (clientRect.left + page.node.scrollLeft - pageRect.left) / scale,
          width: clientRect.width / scale,
          height: clientRect.height / scale,
          pageNumber: page.number,
        });
      }
    });
  });

  return rects;
};
