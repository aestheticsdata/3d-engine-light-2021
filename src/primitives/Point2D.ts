export type Point2DType = (x: number, y: number) => {x: number, y: number};

const Point2D: Point2DType = (x, y) => {
  return {
    x,
    y,
  }
}

export default Point2D;
