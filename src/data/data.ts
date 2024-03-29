type triangle = [number, number, number, string];

export interface Object3D {
	points: number[][];
	triangles: triangle[];
}

export interface Data3D {
	[k: string]: Object3D
}

const data: Data3D = {
	"cube": {
		"points":
			[[-100, -100, -100],
			 [ 100, -100, -100],
			 [ 100,  100, -100],
			 [-100,  100, -100],
			 [-100, -100,  100],
			 [ 100, -100,  100],
			 [ 100,  100,  100],
			 [-100,  100,  100]],
		"triangles":
			[[0,1,2,"rgba(255,255,127,0.3)"],
			 [2,3,0,"rgba(255,255,127,0.3)"],
			 [0,1,5,"rgba(66,66,127,0.3)"],
			 [5,4,0,"rgba(66,66,127,0.3)"],
			 [4,5,6,"rgba(120,66,32,0.3)"],
			 [6,7,4,"rgba(120,66,32,0.3)"],
			 [3,2,6,"rgba(66,255,0,0.3)"],
			 [6,7,3,"rgba(66,255,0,0.3)"],
			 [1,5,6,"rgba(250,120,127,0.3)"],
			 [6,2,1,"rgba(250,120,127,0.3)"],
			 [4,0,3,"rgba(255,0,0,0.3)"],
			 [3,7,4,"rgba(255,0,0,0.3)"]]
	},
	"pyramid": {
		"points":
			[[   0, -100,    0],
			 [ 100,  100, -100],
			 [-100,  100, -100],
			 [-100,  100,  100],
			 [ 100,  100,  100]],
		"triangles":
			[[0,1,2,"rgba(255,255,127,0.3)"],
			 [0,2,3,"rgba(0,255,127,0.3)"],
			 [0,3,4,"rgba(66,66,127,0.3)"],
			 [0,4,1,"rgba(66,0,27,0.3)"],
			 [1,3,2,"rgba(120,66,32,0.3)"],
			 [1,4,3,"rgba(120,66,32,0.3)"]]
	},
	"plate": {
		"points":
			[[-50, -50, -50],
			 [ 50, -50, -50],
			 [ 50,  50, -50],
			 [-50,  50, -50]
			],
		"triangles":
			[[0,1,2,"rgba(255,250,50, 0.8)"],
			 [0,2,3,"rgba(255,250,50, 0.8)"]
			]
	},
	"cross": {
		"points":
			[[-50, -50, -50],
			 [ 50, -50, -50],
			 [ 50,  50, -50],
			 [-50,  50, -50],
			 [-100,0,-100],
			 [50,0,-100],
			 [50,0,50],
			 [-50,0,50]
			],
		"triangles":
			[[0,1,2,"rgba(0,89,150, 0.4)"],
			 [0,2,3,"rgba(0,89,150, 0.4)"],
			 [4,5,6,"rgba(0,89,0, 0.4)"],
			 [4,6,7,"rgba(0,89,0, 0.4)"]
			]
	}
}

export default data;
