const ort = require("onnxruntime-node");
const jimp = require("jimp");
async function x() {
    const session = await ort.InferenceSession.create("./m/ch_PP-OCRv2_det_infer.onnx");

    let image = await jimp.read("../a.png");
    let h = image.bitmap.height,
        w = image.bitmap.width;
    let limit_side_len = 960;
    let ratio = 1;
    if (Math.max(h, w) > limit_side_len) {
        if (h > w) {
            ratio = limit_side_len / h;
        } else {
            ratio = limit_side_len / w;
        }
    }
    let resize_h = h * ratio;
    let resize_w = w * ratio;

    resize_h = Math.max(Math.round(resize_h / 32) * 32, 32);
    resize_w = Math.max(Math.round(resize_w / 32) * 32, 32);
    image = image.resize(resize_w, resize_h);
    var imageBufferData = image.bitmap.data;
    const [redArray, greenArray, blueArray] = new Array(new Array(), new Array(), new Array());

    let scale = 1.0 / 255;
    let mean = [0.485, 0.456, 0.406];
    let std = [0.229, 0.224, 0.225];

    let shapes = [h, w, resize_h / h, resize_w / w];

    let x = 0,
        y = 0;
    for (let i = 0; i < imageBufferData.length; i += 4) {
        if (!blueArray[y]) blueArray[y] = [];
        if (!greenArray[y]) greenArray[y] = [];
        if (!redArray[y]) redArray[y] = [];
        redArray[y][x] = (imageBufferData[i] * scale - mean[0]) / std[0];
        greenArray[y][x] = (imageBufferData[i + 1] * scale - mean[1]) / std[1];
        blueArray[y][x] = (imageBufferData[i + 2] * scale - mean[2]) / std[2];
        x++;
        if (x == w) {
            x = 0;
            y++;
        }
    }

    const transposedData = [blueArray, greenArray, redArray];
    const float32Data = Float32Array.from(transposedData.flat(Infinity));

    const inputTensor = new ort.Tensor("float32", float32Data, [1, 3, image.bitmap.height, image.bitmap.width]);

    const results = await session.run({ x: inputTensor });

    const dataC = results["save_infer_model/scale_0.tmp_1"].data;
    console.log(results);

    let canvas = document.querySelector("canvas");

    var myImageData = new ImageData(resize_w, resize_h);
    for (let i in dataC) {
        let n = i * 4;
        myImageData.data[n] = myImageData.data[n + 1] = myImageData.data[n + 2] = dataC[i] * 255;
        myImageData.data[n + 3] = 255;
    }
    console.log(myImageData);
    canvas.width = results["save_infer_model/scale_0.tmp_1"].dims[3];
    canvas.height = results["save_infer_model/scale_0.tmp_1"].dims[2];
    canvas.getContext("2d").putImageData(myImageData, 0, 0);

    find_contors();
}
x();

function find_contors() {
    let canvas = document.querySelector("canvas");
    var cv = require("opencv.js");

    let edge_rect = [];

    let src = cv.imread(canvas);

    let dst = cv.Mat.zeros(src.cols, src.rows, cv.CV_8UC3);
    cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY, 0);
    cv.threshold(src, src, 120, 200, cv.THRESH_BINARY);
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();

    cv.findContours(src, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    for (let i = 0; i < contours.size(); i++) {
        let cnt = contours.get(i);
        let bounding_box = cv.minAreaRect(cnt);
        let points = cv.RotatedRect.points(bounding_box);
        points = points.sort((a, b) => a.x - b.x);
        let index_1 = 0,
            index_2 = 1,
            index_3 = 2,
            index_4 = 3;
        if (points[1].y > points[0].y) {
            index_1 = 0;
            index_4 = 0;
        } else {
            index_1 = 1;
            index_4 = 0;
        }
        if (points[3].y > points[2].y) {
            index_2 = 2;
            index_3 = 3;
        } else {
            index_2 = 3;
            index_3 = 2;
        }

        box = [points[index_1], points[index_2], points[index_3], points[index_4]];

        let min_size = 3;
        if (Math.min(bounding_box.size.width, bounding_box.size.height) >= min_size) edge_rect.push(box);
    }

    console.log(edge_rect);

    src.delete();
    contours.delete();
    hierarchy.delete();

    src = dst = contours = hierarchy = null;
}
